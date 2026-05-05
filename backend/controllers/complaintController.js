const Complaint = require("../models/Complaint");
const { User }  = require("../models/User");
const fs        = require("fs");
const path      = require("path");

// ─── Helper: delete physical files for a complaint ────────────────────────────
const deleteComplaintFiles = (complaint) => {
    // Delete media[] files
    (complaint.media || []).forEach(({ url }) => {
        if (!url) return;
        const filePath = path.join(__dirname, "..", url);
        if (fs.existsSync(filePath)) {
            try { fs.unlinkSync(filePath); } catch (_) {}
        }
    });
    // Delete legacy image field
    if (complaint.image) {
        const filePath = path.join(__dirname, "..", complaint.image);
        if (fs.existsSync(filePath)) {
            try { fs.unlinkSync(filePath); } catch (_) {}
        }
    }
};

// =============================================================================
// POST /api/complaints
// Student: create a new complaint with optional images + video
// =============================================================================
exports.createComplaint = async (req, res) => {
    try {
        const { title, description, category } = req.body;

        // Auto-fetch door number from student profile
        const student    = await User.findById(req.user.id).select("doorNumber");
        const doorNumber = student?.doorNumber || "N/A";

        // Build media array from uploaded files
        const media = [];
        (req.files?.images || []).forEach((f) =>
            media.push({ url: `/uploads/${f.filename}`, type: "image" })
        );
        (req.files?.video || []).forEach((f) =>
            media.push({ url: `/uploads/${f.filename}`, type: "video" })
        );
        // Backward-compat: if somehow upload.single was used
        if (req.file) {
            media.push({ url: `/uploads/${req.file.filename}`, type: "image" });
        }

        const newComplaint = new Complaint({
            title,
            description,
            category: category || "Other",
            media,
            doorNumber,
            studentId: req.user.id
        });

        await newComplaint.save();

        res.status(201).json({
            message: "Complaint created successfully",
            complaint: newComplaint
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// =============================================================================
// GET /api/complaints/my-complaints
// Student: view their own complaints
// =============================================================================
exports.getStudentComplaints = async (req, res) => {
    try {
        const complaints = await Complaint.find({ studentId: req.user.id })
            .populate("assignedTo", "name email")
            .sort({ createdAt: -1 });
        res.json(complaints);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// =============================================================================
// GET /api/complaints/all
// Warden / Staff: view all complaints with optional filters
// Query params: status, category, from, to, search, student
// =============================================================================
exports.getAllComplaints = async (req, res) => {
    try {
        const { status, category, from, to, search, student } = req.query;

        const filter = {};

        if (status)   filter.status   = status;
        if (category) filter.category = category;

        if (from || to) {
            filter.createdAt = {};
            if (from) filter.createdAt.$gte = new Date(from);
            if (to) {
                const toDate = new Date(to);
                toDate.setHours(23, 59, 59, 999);
                filter.createdAt.$lte = toDate;
            }
        }

        if (search) {
            filter.$or = [
                { title:       { $regex: search, $options: "i" } },
                { description: { $regex: search, $options: "i" } }
            ];
        }

        let complaints = await Complaint.find(filter)
            .populate("studentId", "name fullName email prn rollNumber classDiv year doorNumber")
            .populate("assignedTo", "name email")
            .sort({ createdAt: -1 });

        // Post-populate student name filter (can't do this in mongoose query)
        if (student) {
            const q = student.toLowerCase();
            complaints = complaints.filter((c) => {
                const name = (c.studentId?.fullName || c.studentId?.name || "").toLowerCase();
                return name.includes(q);
            });
        }

        res.json(complaints);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// =============================================================================
// GET /api/complaints/analytics
// Warden: aggregated stats for the dashboard
// Query: ?days=7 (default) or ?days=30
// =============================================================================
exports.getAnalytics = async (req, res) => {
    try {
        const days      = Math.min(parseInt(req.query.days) || 7, 90);
        const sinceDate = new Date();
        sinceDate.setDate(sinceDate.getDate() - days);

        const [statusSummary, byCategory, trend, avgResolution] = await Promise.all([

            // Counts grouped by status
            Complaint.aggregate([
                { $group: { _id: "$status", count: { $sum: 1 } } }
            ]),

            // Counts grouped by category
            Complaint.aggregate([
                { $group: { _id: "$category", count: { $sum: 1 } } },
                { $sort:  { count: -1 } }
            ]),

            // Daily complaint volume for the last N days
            Complaint.aggregate([
                { $match: { createdAt: { $gte: sinceDate } } },
                {
                    $group: {
                        _id:   { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ]),

            // Average resolution time for resolved complaints (in ms)
            Complaint.aggregate([
                {
                    $match: {
                        status:     "Resolved",
                        resolvedAt: { $exists: true, $ne: null }
                    }
                },
                {
                    $project: {
                        resolutionMs: { $subtract: ["$resolvedAt", "$createdAt"] }
                    }
                },
                {
                    $group: { _id: null, avgMs: { $avg: "$resolutionMs" } }
                }
            ])
        ]);

        // Build status map
        const statusMap = { Pending: 0, "In Progress": 0, Resolved: 0 };
        statusSummary.forEach(({ _id, count }) => {
            if (_id in statusMap) statusMap[_id] = count;
        });
        const total = Object.values(statusMap).reduce((a, b) => a + b, 0);

        // Fill every day in the range (even days with 0 complaints)
        const trendMap = {};
        trend.forEach(({ _id, count }) => { trendMap[_id] = count; });
        const filledTrend = [];
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const key = d.toISOString().split("T")[0];
            filledTrend.push({ date: key, count: trendMap[key] || 0 });
        }

        // Average resolution time rounded to 1 decimal hour
        const avgResolutionHours = avgResolution[0]
            ? Math.round((avgResolution[0].avgMs / (1000 * 60 * 60)) * 10) / 10
            : null;

        res.json({
            total,
            pending:       statusMap["Pending"],
            inProgress:    statusMap["In Progress"],
            resolved:      statusMap["Resolved"],
            byCategory,
            trend:         filledTrend,
            avgResolutionHours,
            days
        });

    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// =============================================================================
// PUT /api/complaints/:id/status
// Warden / Staff: update complaint status
// =============================================================================
exports.updateComplaintStatus = async (req, res) => {
    try {
        const { id }     = req.params;
        const { status } = req.body;

        const allowedStatuses = ["Pending", "In Progress", "Resolved"];
        if (!status || !allowedStatuses.includes(status)) {
            return res.status(400).json({
                message: `Status must be one of: ${allowedStatuses.join(", ")}`
            });
        }

        const update = { status };
        if (status === "Resolved") {
            update.resolvedAt = new Date(); // Capture resolution timestamp for analytics
        }

        const complaint = await Complaint.findByIdAndUpdate(id, update, { returnDocument: "after" });
        if (!complaint) return res.status(404).json({ message: "Complaint not found" });

        res.json({ message: "Status updated successfully", complaint });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// =============================================================================
// PUT /api/complaints/assign/:id
// Warden: assign complaint to a staff member
// =============================================================================
exports.assignComplaint = async (req, res) => {
    try {
        const { id }      = req.params;
        const { staffId } = req.body;

        if (!staffId) {
            return res.status(400).json({ message: "staffId is required" });
        }

        const staffMember = await User.findById(staffId);
        if (!staffMember) {
            return res.status(404).json({ message: "Staff member not found" });
        }
        if (staffMember.role !== "STAFF") {
            return res.status(400).json({ message: "Assigned user must have STAFF role" });
        }

        const complaint = await Complaint.findByIdAndUpdate(
            id,
            { assignedTo: staffId, status: "In Progress" },
            { returnDocument: "after" }
        );

        if (!complaint) return res.status(404).json({ message: "Complaint not found" });

        res.json({ message: "Complaint assigned successfully", complaint });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// =============================================================================
// DELETE /api/complaints/:id
// Warden: delete complaint and associated files
// =============================================================================
exports.deleteComplaint = async (req, res) => {
    try {
        const { id } = req.params;
        const complaint = await Complaint.findById(id);

        if (!complaint) return res.status(404).json({ message: "Complaint not found" });

        deleteComplaintFiles(complaint);

        await Complaint.findByIdAndDelete(id);
        res.json({ message: "Complaint deleted successfully" });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};