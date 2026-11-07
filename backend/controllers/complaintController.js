const Complaint = require("../models/Complaint");
const Incident  = require("../models/Incident");
const { User, Student }  = require("../models/User");
const fs        = require("fs");
const path      = require("path");
const {
    emitComplaintCreated,
    emitComplaintStatusUpdated,
    emitComplaintAssigned,
    emitComplaintDeleted,
    emitIncidentCreated,
    emitIncidentUpdated,
    emitServiceHeatmapUpdate
} = require("../socket");
const { processComplaintForIncidents } = require("../services/incidentDetector");
const { createNotification } = require("../services/notificationService");
const { routeAndAssignComplaint } = require("../services/workloadRoutingService");
const ComplaintEvent = require("../models/ComplaintEvent");
const AuditLog = require("../models/AuditLog");

// In-flight mutex to prevent concurrent duplicate submissions within short time window
const inFlightSubmissions = new Map();

const deleteComplaintFiles = (complaint) => {
    // Helper to safely delete a file given its URL
    const safeDelete = (url) => {
        if (!url) return;
        const filePath = path.join(__dirname, "..", url);
        if (fs.existsSync(filePath)) {
            try { fs.unlinkSync(filePath); } catch (_) {}
        }
    };

    // Delete media[] files
    (complaint.media || []).forEach(({ url }) => safeDelete(url));
    
    // Delete legacy image field
    if (complaint.image) {
        safeDelete(complaint.image);
    }

    // Delete feedback media files
    if (complaint.feedback && complaint.feedback.media) {
        (complaint.feedback.media || []).forEach(({ url }) => safeDelete(url));
    }
};

// =============================================================================
// POST /api/complaints
// Student: create a new complaint with optional images + video
// =============================================================================
exports.createComplaint = async (req, res) => {
    try {
        let { title, description, category, quickCategory, parentComplaintId } = req.body;

        // Auto-fetch door number from verified student profile
        const student = (await Student.findById(req.user.id)) || (await User.findById(req.user.id));
        const doorNumber = student?.doorNumber;

        // Server-side room validation: student MUST have a registered room assignment
        if (!doorNumber || doorNumber === "N/A" || doorNumber.trim() === "") {
            return res.status(400).json({
                message: "Registered room assignment is missing. Please complete your room profile before submitting complaints."
            });
        }

        // Clean mapping for quick-service categories
        if (category === "NO_WATER_SUPPLY") {
            quickCategory = "NO_WATER_SUPPLY";
            category = "Plumbing";
        } else if (category === "NO_ELECTRICITY") {
            quickCategory = "NO_ELECTRICITY";
            category = "Electrical";
        } else if (category === "WIFI_NOT_WORKING") {
            quickCategory = "WIFI_NOT_WORKING";
            category = "Internet";
        }

        // Build media array from uploaded files
        const media = [];
        (req.files?.images || []).forEach((f) =>
            media.push({ url: `/uploads/${f.filename}`, type: "image" })
        );
        (req.files?.video || []).forEach((f) =>
            media.push({ url: `/uploads/${f.filename}`, type: "video" })
        );
        // Backward-compat: if upload.single was used
        if (req.file) {
            media.push({ url: `/uploads/${req.file.filename}`, type: "image" });
        }

        const now = new Date();

        let resolvedCategory = category;
        if (!resolvedCategory || resolvedCategory === "Other") {
            if (quickCategory === "NO_WATER_SUPPLY") resolvedCategory = "Plumbing";
            else if (quickCategory === "NO_ELECTRICITY") resolvedCategory = "Electrical";
            else if (quickCategory === "WIFI_NOT_WORKING") resolvedCategory = "Internet";
            else resolvedCategory = "Other";
        }

        // ─── Duplicate Submission Prevention / Retry Filtering ───────────────
        // Prevent duplicate complaints caused by accidental double-clicks or network retries within 5 seconds
        const subKey = `${req.user.id}:${title.trim()}:${resolvedCategory}`;
        if (inFlightSubmissions.has(subKey)) {
            const inFlightResult = await inFlightSubmissions.get(subKey);
            return res.status(200).json({
                message: "Complaint already received and recorded (in-flight duplicate retry filtered)",
                complaint: inFlightResult
            });
        }

        let resolveSubmission = () => {};
        const subPromise = new Promise(r => { resolveSubmission = r; });
        inFlightSubmissions.set(subKey, subPromise);
        setTimeout(() => inFlightSubmissions.delete(subKey), 5000);

        const duplicateWindow = new Date(Date.now() - 5000);
        const existingRecentComplaint = await Complaint.findOne({
            studentId: req.user.id,
            title: title.trim(),
            category: resolvedCategory,
            createdAt: { $gte: duplicateWindow }
        });
        if (existingRecentComplaint) {
            resolveSubmission(existingRecentComplaint);
            return res.status(200).json({
                message: "Complaint already received and recorded (duplicate retry filtered)",
                complaint: existingRecentComplaint
            });
        }

        let parentComplaint = null;
        if (parentComplaintId) {
            parentComplaint = await Complaint.findById(parentComplaintId);
        }

        const newComplaint = new Complaint({
            title,
            description: description || (quickCategory ? `Quick report: ${title}` : ""),
            category: resolvedCategory,
            quickCategory: quickCategory || null,
            media,
            doorNumber: String(doorNumber).trim(),
            studentId: req.user.id,
            parentComplaintId: parentComplaint ? parentComplaint._id : null,
            // Seed initial history entry so the timeline always starts at "Raised"
            statusHistory: [{
                status: "Pending",
                timestamp: now,
                note: parentComplaint
                    ? `Associated with active room issue #${parentComplaint._id.toString().slice(-6)}`
                    : "Complaint raised by student"
            }]
        });

        await newComplaint.save();
        resolveSubmission(newComplaint);

        // Record append-only SUBMITTED event
        await ComplaintEvent.create({
            complaintId: newComplaint._id,
            eventType: "SUBMITTED",
            actor: { id: req.user.id, name: student?.name || "Student", role: "STUDENT" },
            newState: { title: newComplaint.title, category: resolvedCategory, doorNumber },
            note: `Complaint submitted by student in Room ${doorNumber}`
        });

        // Automatic workload-based department routing & employee assignment
        try {
            await routeAndAssignComplaint({
                complaintId: newComplaint._id,
                selectedCategory: resolvedCategory,
                studentId: req.user.id,
                actor: { id: req.user.id, name: student?.name || "Student", role: "STUDENT" }
            });
        } catch (routeErr) {
            console.error("[ROUTING_ERROR]", routeErr.message);
        }

        if (parentComplaint) {
            if (!parentComplaint.associatedComplaints) parentComplaint.associatedComplaints = [];
            parentComplaint.associatedComplaints.push(newComplaint._id);
            parentComplaint.statusHistory.push({
                status: parentComplaint.status,
                timestamp: now,
                actor: "Roommate",
                note: `Roommate submitted report #${newComplaint._id.toString().slice(-6)} associated with this issue.`
            });
            await parentComplaint.save();
        }

        // Check for shared incidents (Water / Electricity)
        await processComplaintForIncidents(newComplaint, { emitIncidentCreated, emitIncidentUpdated });

        const populatedComplaint = await Complaint.findById(newComplaint._id)
            .populate("studentId", "name fullName email prn rollNumber classDiv year doorNumber")
            .populate("assignedTo", "name email staffRole")
            .populate("departmentId", "name code template supervisor")
            .populate("incidentId", "incidentNumber title status");

        emitComplaintCreated(populatedComplaint || newComplaint);

        // Persistent administrative notification with strict role boundaries
        const notifCat = newComplaint.quickCategory || newComplaint.category;
        const isWifiNotif = notifCat === "WIFI_NOT_WORKING" || notifCat === "Internet";
        const catLabel = notifCat ? notifCat.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : "";

        if (isWifiNotif) {
            createNotification({
                recipientRole: "WIFI_INCHARGE",
                title: "New Wi-Fi Complaint",
                message: `Room ${doorNumber}: ${newComplaint.title}`,
                category: "COMPLAINT",
                priority: newComplaint.priority === "Urgent" ? "URGENT" : "HIGH",
                entityType: "complaint",
                entityId: newComplaint._id.toString(),
                metadata: { room: doorNumber, category: notifCat },
                dedupKey: `complaint_created_${newComplaint._id}`
            }).catch(e => console.error("Notification error:", e.message));
        } else {
            // General maintenance / Water / Electricity -> Warden, Head Warden, Incharge
            ["WARDEN", "HEADWARDEN", "INCHARGE"].forEach(r => {
                createNotification({
                    recipientRole: r,
                    title: catLabel ? `New Complaint (${catLabel})` : "New Complaint",
                    message: `Room ${doorNumber}: ${newComplaint.title}`,
                    category: "COMPLAINT",
                    priority: newComplaint.priority === "Urgent" ? "URGENT" : "MEDIUM",
                    entityType: "complaint",
                    entityId: newComplaint._id.toString(),
                    metadata: { room: doorNumber, category: notifCat },
                    dedupKey: `complaint_created_${newComplaint._id}_${r}`
                }).catch(e => console.error("Notification error:", e.message));
            });
        }
        emitServiceHeatmapUpdate({
            room: doorNumber,
            category: newComplaint.category,
            quickCategory: newComplaint.quickCategory
        });

        res.status(201).json({
            message: "Complaint created successfully",
            complaint: populatedComplaint || newComplaint
        });
    } catch (err) {
        if (typeof subKey !== "undefined") {
            inFlightSubmissions.delete(subKey);
        }
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
            .populate("studentId", "name fullName email prn rollNumber classDiv year branch doorNumber")
            .populate("assignedTo", "name email staffRole")
            .populate("departmentId", "name code template supervisor")
            .sort({ createdAt: -1 })
            .lean();
        res.json(complaints);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// =============================================================================
// GET /api/complaints/:id
// Get single complaint with strict role/department/anti-ragging authorization
// =============================================================================
exports.getComplaintById = async (req, res) => {
    try {
        const { id } = req.params;
        const complaint = await Complaint.findById(id)
            .populate("studentId", "name fullName email prn rollNumber classDiv year doorNumber mobileNumber")
            .populate("assignedTo", "name email staffRole designation phoneNumber")
            .populate("departmentId", "name code template supervisor")
            .lean();

        if (!complaint) return res.status(404).json({ message: "Complaint not found" });

        // 🔒 Anti-ragging isolation
        if (complaint.isAntiRagging || complaint.isConfidential || (complaint.category && complaint.category.match(/ragging/i))) {
            const isAuthorizedAdmin = ["MAIN_ADMIN", "INCHARGE"].includes(req.user?.role);
            const isAntiRaggingSpecialist = (req.user?.dashboardPermissions || []).includes("ANTI_RAGGING") ||
                (req.user?.departmentId && String(req.user.departmentId) === String(complaint.departmentId?._id || complaint.departmentId));
            const isStudentOwner = String(complaint.studentId?._id || complaint.studentId) === String(req.user?.id);

            if (!isAuthorizedAdmin && !isAntiRaggingSpecialist && !isStudentOwner) {
                return res.status(403).json({
                    message: "Access denied: Strictly confidential Anti-Ragging clearance required",
                    code: "ANTI_RAGGING_CONFIDENTIALITY_BOUNDARY"
                });
            }
        }

        // 🔒 Staff isolation: Can view if assigned to them, belongs to their department, or is supervisor
        if (req.user?.role === "STAFF") {
            const isAssigned = String(complaint.assignedTo?._id || complaint.assignedTo) === String(req.user.id);
            const deptIdStr = String(complaint.departmentId?._id || complaint.departmentId || "");
            const userDeptIdStr = String(req.user.departmentId || "");
            const isDeptMember = deptIdStr && (deptIdStr === userDeptIdStr || (req.user.authorizedDepartments || []).map(String).includes(deptIdStr));

            if (!isAssigned && !isDeptMember && !req.user.isSupervisor) {
                return res.status(403).json({ message: "Access denied: You can only view complaints in your assigned department." });
            }
        }

        res.json({ success: true, complaint });
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

        // Patch: Force string type to prevent object injection
        if (status)   filter.status   = String(status);
        if (category) filter.category = String(category);

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
                // Patch: Force string type to prevent regex object injection
                { title:       { $regex: String(search), $options: "i" } },
                { description: { $regex: String(search), $options: "i" } }
            ];
        }

        // 🔒 Mandatory Privacy Barrier: Anti-Ragging strictly isolated
        const Department = require("../models/Department");
        const antiRaggingDept = await Department.findOne({ code: "ANTI_RAGGING" });

        const isAntiRaggingAuthorized = ["MAIN_ADMIN", "INCHARGE"].includes(req.user?.role) ||
            (req.user?.dashboardPermissions || []).includes("ANTI_RAGGING") ||
            (req.user?.departmentId && antiRaggingDept && String(req.user.departmentId) === String(antiRaggingDept._id));

        if (!isAntiRaggingAuthorized) {
            filter.isAntiRagging = { $ne: true };
            filter.isConfidential = { $ne: true };
            if (category && ["Anti-Ragging", "Anti Ragging", "Ragging"].includes(category)) {
                return res.status(403).json({
                    message: "Access denied: Strictly confidential Anti-Ragging clearance required",
                    code: "ANTI_RAGGING_CONFIDENTIALITY_BOUNDARY"
                });
            }
            if (!filter.category) {
                filter.category = { $nin: ["Anti-Ragging", "Anti Ragging", "Ragging"] };
            }
            if (antiRaggingDept) {
                filter.departmentId = { $ne: antiRaggingDept._id };
            }
        }

        // Optional department filter
        const { department: deptQuery } = req.query;
        if (deptQuery && deptQuery !== "all") {
            const dDoc = await Department.findOne({
                $or: [
                    { _id: require("mongoose").isValidObjectId(deptQuery) ? deptQuery : null },
                    { code: String(deptQuery).toUpperCase() },
                    { name: deptQuery }
                ]
            });
            if (dDoc) filter.departmentId = dDoc._id;
        }

        // 🔒 Staff Workload Isolation: Employees can access ONLY their own assigned complaints
        if (req.user?.role === "STAFF") {
            filter.assignedTo = req.user.id;
        }

        // Exclude Wi-Fi complaints from Warden / Management complaint queues
        if (["WARDEN", "HEADWARDEN", "Warden", "Head Warden"].includes(req.user?.role)) {
            if (category === "Internet" || category === "WIFI_NOT_WORKING") {
                return res.json([]);
            }
            if (!category) {
                filter.category = { $ne: "Internet" };
            }
            filter.quickCategory = { $ne: "WIFI_NOT_WORKING" };
        }

        const populateFields = req.user?.role === "STAFF"
            ? "name doorNumber mobileNumber"
            : "name fullName email prn rollNumber classDiv year doorNumber";

        let complaints = await Complaint.find(filter)
            .populate("studentId", populateFields)
            .populate("assignedTo", "name email staffRole")
            .populate("departmentId", "name code template supervisor")
            .sort({ createdAt: -1 })
            .lean();

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

        // Enforce Wi-Fi isolation for WARDEN: strictly exclude Wi-Fi records
        const baseMatch = {};
        if (req.user?.role === "WARDEN") {
            baseMatch.category = { $ne: "Internet" };
            baseMatch.quickCategory = { $ne: "WIFI_NOT_WORKING" };
        }

        const isAntiRaggingAuthorized = ["MAIN_ADMIN", "INCHARGE"].includes(req.user?.role) ||
            (req.user?.dashboardPermissions || []).includes("ANTI_RAGGING");
        if (!isAntiRaggingAuthorized) {
            baseMatch.isAntiRagging = { $ne: true };
            baseMatch.isConfidential = { $ne: true };
            if (baseMatch.category) {
                baseMatch.category = { $nin: ["Internet", "Anti-Ragging", "Anti Ragging", "Ragging"] };
            } else {
                baseMatch.category = { $nin: ["Anti-Ragging", "Anti Ragging", "Ragging"] };
            }
        }

        const [statusSummary, byCategory, trend, avgResolution] = await Promise.all([
            // Counts grouped by status
            Complaint.aggregate([
                ...(Object.keys(baseMatch).length ? [{ $match: baseMatch }] : []),
                { $group: { _id: "$status", count: { $sum: 1 } } }
            ]),

            // Counts grouped by category
            Complaint.aggregate([
                ...(Object.keys(baseMatch).length ? [{ $match: baseMatch }] : []),
                { $group: { _id: "$category", count: { $sum: 1 } } },
                { $sort:  { count: -1 } }
            ]),

            // Daily complaint volume for the last N days
            Complaint.aggregate([
                { $match: { ...baseMatch, createdAt: { $gte: sinceDate } } },
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
        const { status, resolutionNote } = req.body;

        const allowedStatuses = ["Pending", "In Progress", "Resolved", "Reopened"];
        if (!status || !allowedStatuses.includes(status)) {
            return res.status(400).json({
                message: `Status must be one of: ${allowedStatuses.join(", ")}`
            });
        }

        const now  = new Date();
        const defaultNote = {
            "Pending":     "Status set back to Pending",
            "In Progress": resolutionNote || "Work started by maintenance staff",
            "Resolved":    resolutionNote || "Issue resolved and checked by staff",
            "Reopened":    resolutionNote || "Complaint reopened for inspection"
        }[status] || "";

        const existingDoc = await Complaint.findById(id);
        if (!existingDoc) return res.status(404).json({ message: "Complaint not found" });

        const currentStatus = existingDoc.status || "Pending";
        const VALID_STATUS_TRANSITIONS = {
            "Pending": ["In Progress", "Pending"],
            "In Progress": ["Resolved", "In Progress"],
            "Resolved": ["Reopened", "Resolved"],
            "Reopened": ["In Progress", "Reopened"]
        };
        if (status !== currentStatus && !VALID_STATUS_TRANSITIONS[currentStatus]?.includes(status)) {
            return res.status(400).json({
                message: `Invalid status transition from "${currentStatus}" to "${status}". Allowed transitions: ${VALID_STATUS_TRANSITIONS[currentStatus]?.filter(s => s !== currentStatus).join(", ") || "none"}`
            });
        }

        const resolvedStaffId = req.user?.role === "STAFF"
            ? req.user._id
            : (existingDoc?.assignedTo || null);

        const update = {
            status,
            $push: {
                statusHistory: {
                    status,
                    timestamp: now,
                    note: defaultNote,
                    actor: req.user?.name || req.user?.role || "Staff",
                    actorId: req.user?._id || null,
                    staffId: resolvedStaffId
                }
            }
        };
        if (status === "Resolved") {
            update.resolvedAt = now;
            if (resolutionNote) update.resolutionNote = resolutionNote;
        }

        const complaint = await Complaint.findOneAndUpdate(
            { _id: id, status: currentStatus },
            update,
            { returnDocument: "after" }
        );
        if (!complaint) {
            return res.status(409).json({
                message: "Concurrent update detected: The complaint status was modified simultaneously by another user. Please refresh and retry."
            });
        }

        // Administrative & Operational Audit Logging
        if (status === "Resolved") {
            await AuditLog.create({
                action: "COMPLAINT_RESOLVED",
                performedBy: {
                    id: req.user?.id || req.user?._id,
                    name: req.user?.name || req.user?.role || "Staff",
                    role: req.user?.role || "STAFF",
                    email: req.user?.email || ""
                },
                target: { id: complaint._id, model: "Complaint", identifier: complaint.title },
                details: { previousStatus: currentStatus, newStatus: status, resolutionNote: resolutionNote || defaultNote, outcome: "SUCCESS" }
            }).catch(e => console.error("AuditLog COMPLAINT_RESOLVED error:", e.message));
        } else if (status === "Reopened") {
            await AuditLog.create({
                action: "COMPLAINT_REOPENED",
                performedBy: {
                    id: req.user?.id || req.user?._id,
                    name: req.user?.name || req.user?.role || "User",
                    role: req.user?.role || "STUDENT",
                    email: req.user?.email || ""
                },
                target: { id: complaint._id, model: "Complaint", identifier: complaint.title },
                details: { previousStatus: currentStatus, newStatus: status, reason: resolutionNote || defaultNote, outcome: "SUCCESS" }
            }).catch(e => console.error("AuditLog COMPLAINT_REOPENED error:", e.message));
        }

        const populatedComplaint = await Complaint.findById(id)
            .populate("studentId", "name fullName email prn rollNumber classDiv year doorNumber")
            .populate("assignedTo", "name email staffRole")
            .populate("departmentId", "name code template supervisor");

        emitComplaintStatusUpdated(populatedComplaint || complaint);

        res.json({ message: "Status updated successfully", complaint: populatedComplaint || complaint });
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

        const existingComplaint = await Complaint.findById(id);
        if (!existingComplaint) return res.status(404).json({ message: "Complaint not found" });

        const now = new Date();
        const reason = req.body.reason || "Management operational intervention";
        const note = `Assigned to ${staffMember.name}. Reason: ${reason}`;

        if (existingComplaint.assignedTo && String(existingComplaint.assignedTo) !== String(staffId)) {
            existingComplaint.reassignmentHistory.push({
                previousStaff: existingComplaint.assignedTo,
                newStaff: staffId,
                reason,
                reassignedBy: req.user?.id || req.user?._id,
                reassignedByRole: req.user?.role || "MANAGEMENT",
                timestamp: now
            });
            await ComplaintEvent.create({
                complaintId: existingComplaint._id,
                eventType: "REASSIGNED",
                actor: { id: req.user?.id || req.user?._id, name: req.user?.name || "Management", role: req.user?.role || "MANAGEMENT" },
                previousState: { assignedTo: existingComplaint.assignedTo },
                newState: { assignedTo: staffId, staffName: staffMember.name },
                note: reason
            });
        } else {
            await ComplaintEvent.create({
                complaintId: existingComplaint._id,
                eventType: "ASSIGNED",
                actor: { id: req.user?.id || req.user?._id, name: req.user?.name || "Management", role: req.user?.role || "MANAGEMENT" },
                newState: { assignedTo: staffId, staffName: staffMember.name },
                note: `Assigned by ${req.user?.name || 'Management'}`
            });
        }

        existingComplaint.assignedTo = staffId;
        existingComplaint.assignedAt = now;
        existingComplaint.lifecycleState = "ASSIGNED";
        existingComplaint.status = "In Progress";
        existingComplaint.statusHistory.push({
            status: "Assigned",
            timestamp: now,
            note,
            actor: req.user?.name || "Warden",
            actorId: req.user?._id || req.user?.id || null,
            staffId
        });
        await existingComplaint.save();

        const isReassignment = existingComplaint.reassignmentHistory.length > 0 &&
            String(existingComplaint.reassignmentHistory[existingComplaint.reassignmentHistory.length - 1].newStaff) === String(staffId);

        await AuditLog.create({
            action: isReassignment ? "COMPLAINT_REASSIGNED" : "COMPLAINT_ASSIGNED",
            performedBy: {
                id: req.user?.id || req.user?._id,
                name: req.user?.name || "Management",
                role: req.user?.role || "MANAGEMENT",
                email: req.user?.email || ""
            },
            target: { id: existingComplaint._id, model: "Complaint", identifier: existingComplaint.title },
            details: {
                assignedStaffId: staffId,
                staffName: staffMember.name,
                reason,
                outcome: "SUCCESS"
            }
        }).catch(e => console.error("AuditLog assignment error:", e.message));

        const complaint = existingComplaint;

        const populatedComplaint = await Complaint.findById(id)
            .populate("studentId", "name fullName email prn rollNumber classDiv year doorNumber")
            .populate("assignedTo", "name email staffRole")
            .populate("departmentId", "name code template supervisor");

        emitComplaintAssigned(populatedComplaint || complaint);

        // Notify assigned staff member
        const assignedCat = complaint.quickCategory || complaint.category;
        const isWifiAssigned = assignedCat === "WIFI_NOT_WORKING" || assignedCat === "Internet";
        const assignedRoom = complaint.doorNumber || "";

        createNotification({
            recipient: staffId,
            recipientRole: "STAFF",
            title: "Task Assigned",
            message: `You were assigned to: ${complaint.title}${assignedRoom ? ` (Room ${assignedRoom})` : ""}`,
            category: "COMPLAINT",
            priority: "HIGH",
            entityType: "complaint",
            entityId: id.toString(),
            metadata: { room: assignedRoom, category: assignedCat },
            dedupKey: `complaint_assigned_${id}_${staffId}`
        }).catch(e => console.error("Staff notification error:", e.message));

        if (!isWifiAssigned) {
            ["WARDEN", "HEADWARDEN", "INCHARGE"].forEach(r => {
                createNotification({
                    recipientRole: r,
                    title: `Task Assigned: ${staffMember.name}`,
                    message: `Assigned to ${staffMember.name}: ${complaint.title}`,
                    category: "COMPLAINT",
                    priority: "LOW",
                    entityType: "complaint",
                    entityId: id.toString(),
                    metadata: { room: assignedRoom, category: assignedCat, staffName: staffMember.name },
                    dedupKey: `complaint_assigned_${id}_${r}`
                }).catch(e => console.error("Admin notification error:", e.message));
            });
        }

        res.json({ message: "Complaint assigned successfully", complaint: populatedComplaint || complaint });
    } catch (err) {
        if (err.name === "VersionError") {
            return res.status(409).json({
                message: "Concurrent update detected: This complaint was modified simultaneously by another user. Please refresh and retry."
            });
        }
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// =============================================================================
// DELETE /api/complaints/:id
// Disabled for transparency: No manual complaint deletion is permitted
// =============================================================================
exports.deleteComplaint = async (req, res) => {
    return res.status(403).json({
        message: "Manual complaint deletion is disabled across the system for transparency and audit compliance. Complaints are automatically retained for 6 months."
    });
};

// =============================================================================
// Automatic 6-Month Complaint Retention Policy
// Removes complaints older than 180 days (6 months) along with their media files
// =============================================================================
exports.cleanupOldComplaints = async () => {
    try {
        const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
        // Preserve historical data: mark resolved older complaints as archived rather than hard-deleting
        const result = await Complaint.updateMany(
            { createdAt: { $lt: sixMonthsAgo }, status: "Resolved", isArchived: { $ne: true } },
            { $set: { isArchived: true } }
        );
        if (result.modifiedCount > 0) {
            console.log(`[Retention Policy] Safely archived ${result.modifiedCount} historical complaints older than 6 months (zero data loss).`);
        }
        return result.modifiedCount;
    } catch (err) {
        console.error("[Retention Policy] Error during automatic complaint archival:", err);
    }
};

// =============================================================================
// POST /api/complaints/:id/feedback
// Student: Submit feedback for a resolved complaint
// =============================================================================
exports.submitFeedback = async (req, res) => {
    try {
        const { id } = req.params;
        const { isSatisfied, text } = req.body;

        const complaint = await Complaint.findById(id);

        if (!complaint) return res.status(404).json({ message: "Complaint not found" });

        // Ensure user owns the complaint
        if (complaint.studentId.toString() !== req.user.id) {
            return res.status(403).json({ message: "Not authorized to leave feedback for this complaint" });
        }

        if (complaint.status !== "Resolved") {
            return res.status(400).json({ message: "Can only leave feedback for resolved complaints" });
        }

        const isSatisfiedBool = isSatisfied === 'true' || isSatisfied === true;

        if (!isSatisfiedBool) {
            if (!text) {
                 return res.status(400).json({ message: "Explanation text is required if not satisfied" });
            }
            if (!req.files || (!req.files['images'] && !req.files['video'])) {
                 return res.status(400).json({ message: "At least 1 image or video is required as evidence if not satisfied" });
            }
        }

        const media = [];
        if (req.files) {
            if (req.files["images"]) {
                req.files["images"].forEach(file => {
                    media.push({
                        url: `/uploads/${file.filename}`,
                        type: "image"
                    });
                });
            }
            if (req.files["video"]) {
                req.files["video"].forEach(file => {
                    media.push({
                        url: `/uploads/${file.filename}`,
                        type: "video"
                    });
                });
            }
        }

        const now = new Date();

        complaint.feedback = {
            isSatisfied: isSatisfiedBool,
            text:        text || "",
            submittedAt: now,
            media:       media
        };

        // Find all explicitly linked roommate complaints for this shared issue
        const relatedComplaintIds = new Set();
        if (complaint.parentComplaintId) {
            relatedComplaintIds.add(String(complaint.parentComplaintId));
            const siblingComplaints = await Complaint.find({
                parentComplaintId: complaint.parentComplaintId,
                _id: { $ne: complaint._id }
            });
            siblingComplaints.forEach(c => relatedComplaintIds.add(String(c._id)));
        }
        if (complaint.associatedComplaints && complaint.associatedComplaints.length > 0) {
            complaint.associatedComplaints.forEach(cid => relatedComplaintIds.add(String(cid)));
            const childComplaints = await Complaint.find({
                parentComplaintId: complaint._id,
                _id: { $ne: complaint._id }
            });
            childComplaints.forEach(c => relatedComplaintIds.add(String(c._id)));
        }

        const studentUser = (await Student.findById(req.user.id)) || (await User.findById(req.user.id));
        const studentName = studentUser?.fullName || studentUser?.name || "Roommate";

        if (!isSatisfiedBool) {
            complaint.status = "Reopened";
            complaint.followUpRequired = true;
            complaint.roomConfirmedWorking = false;
            complaint.statusHistory.push({
                status:    "Reopened",
                timestamp: now,
                actor:     studentName,
                note:      text ? `Student reopened issue: ${text}` : "Student reported issue was not resolved"
            });

            for (const relId of relatedComplaintIds) {
                const rel = await Complaint.findById(relId);
                if (rel) {
                    rel.status = "Reopened";
                    rel.followUpRequired = true;
                    rel.roomConfirmedWorking = false;
                    rel.statusHistory.push({
                        status:    "Reopened",
                        timestamp: now,
                        actor:     "Roommate Follow-up",
                        note:      `Roommate (${studentName}) reported problem still exists. Room returned to follow-up.`
                    });
                    await rel.save();
                    const popRel = await Complaint.findById(rel._id)
                        .populate("studentId", "name fullName email prn rollNumber classDiv year doorNumber")
                        .populate("assignedTo", "name email staffRole")
            .populate("departmentId", "name code template supervisor");
                    emitComplaintStatusUpdated(popRel || rel);
                }
            }
        } else {
            // Student confirmed satisfied — either roommate's positive confirmation marks room as student-confirmed working
            complaint.roomConfirmedWorking = true;
            complaint.followUpRequired = false;
            complaint.statusHistory.push({
                status:    "Feedback",
                timestamp: now,
                actor:     studentName,
                note:      text ? `Student feedback: ${text}` : "Student confirmed issue resolved to satisfaction"
            });

            for (const relId of relatedComplaintIds) {
                const rel = await Complaint.findById(relId);
                if (rel) {
                    rel.roomConfirmedWorking = true;
                    rel.followUpRequired = false;
                    rel.roommateConfirmation = {
                        confirmedBy: String(req.user.id),
                        confirmedAt: now,
                        message: `Your roommate (${studentName}) confirmed the issue is working. No further confirmation required.`
                    };
                    rel.statusHistory.push({
                        status:    "Feedback",
                        timestamp: now,
                        actor:     "Roommate",
                        note:      `Roommate (${studentName}) confirmed issue is working for room ${complaint.doorNumber}.`
                    });
                    await rel.save();
                    const popRel = await Complaint.findById(rel._id)
                        .populate("studentId", "name fullName email prn rollNumber classDiv year doorNumber")
                        .populate("assignedTo", "name email staffRole")
            .populate("departmentId", "name code template supervisor");
                    emitComplaintStatusUpdated(popRel || rel);
                }
            }
        }

        await complaint.save();

        const populatedComplaint = await Complaint.findById(id)
            .populate("studentId", "name fullName email prn rollNumber classDiv year doorNumber")
            .populate("assignedTo", "name email staffRole")
            .populate("departmentId", "name code template supervisor");

        emitComplaintStatusUpdated(populatedComplaint || complaint);

        res.json({ message: "Feedback submitted successfully", complaint: populatedComplaint || complaint });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// =============================================================================
// POST /api/complaints/:id/reopen
// Student / Management: Reopen a resolved complaint
// =============================================================================
exports.reopenComplaint = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const complaint = await Complaint.findById(id);
        if (!complaint) return res.status(404).json({ message: "Complaint not found" });

        const now = new Date();
        const actorName = req.user.name || "Student";
        complaint.status = "Reopened";
        complaint.followUpRequired = true;
        complaint.roomConfirmedWorking = false;
        complaint.statusHistory.push({
            status: "Reopened",
            timestamp: now,
            actor: actorName,
            note: reason ? `Complaint reopened: ${reason}` : "Complaint reopened for further inspection"
        });
        await complaint.save();

        await ComplaintEvent.create({
            complaintId: complaint._id,
            eventType: "REOPENED",
            actor: { id: req.user.id, name: actorName, role: req.user.role },
            newState: { status: "Reopened" },
            note: reason || "Complaint reopened"
        });

        await AuditLog.create({
            action: "COMPLAINT_REOPENED",
            performedBy: { id: req.user.id, name: actorName, role: req.user.role, email: req.user.email || "" },
            target: { id: complaint._id, model: "Complaint", identifier: complaint.title },
            details: { reason: reason || "Complaint reopened for further inspection", outcome: "SUCCESS" }
        }).catch(e => console.error("AuditLog error:", e.message));

        const populated = await Complaint.findById(id)
            .populate("studentId", "name fullName email prn rollNumber classDiv year doorNumber")
            .populate("assignedTo", "name email staffRole")
            .populate("departmentId", "name code template supervisor");

        emitComplaintStatusUpdated(populated || complaint);
        res.json({ success: true, message: "Complaint reopened successfully", complaint: populated || complaint });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// =============================================================================
// GET /api/complaints/check-duplicate
// Student: checks if an active complaint already exists for this room & category
// =============================================================================
exports.checkDuplicate = async (req, res) => {
    try {
        const { category, quickCategory } = req.query;
        const student = await Student.findById(req.user.id);
        const doorNumber = student?.doorNumber;

        if (!doorNumber) {
            return res.json({ hasDuplicate: false });
        }

        let catQuery = category;
        if (category === "NO_WATER_SUPPLY" || quickCategory === "NO_WATER_SUPPLY") catQuery = "Plumbing";
        if (category === "NO_ELECTRICITY" || quickCategory === "NO_ELECTRICITY") catQuery = "Electrical";
        if (category === "WIFI_NOT_WORKING" || quickCategory === "WIFI_NOT_WORKING") catQuery = "Internet";

        const existing = await Complaint.findOne({
            doorNumber,
            $or: [
                { category: catQuery },
                { quickCategory: category || quickCategory }
            ],
            status: { $in: ["Pending", "In Progress", "Reopened"] }
        }).populate("studentId", "name fullName").sort({ createdAt: -1 });

        if (existing) {
            const isOwnReport = String(existing.studentId?._id || existing.studentId) === String(req.user.id);
            const reporterName = existing.studentId?.fullName || existing.studentId?.name || "Roommate";
            return res.json({
                hasDuplicate: true,
                existingComplaint: {
                    id: existing._id,
                    title: existing.title,
                    status: existing.status,
                    createdAt: existing.createdAt,
                    studentId: existing.studentId?._id || existing.studentId,
                    studentName: reporterName,
                    isOwnReport
                }
            });
        }

        return res.json({ hasDuplicate: false });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// =============================================================================
// GET /api/complaints/:id/student-contact
// Authorized on-demand retrieval of student contact details (with permission checks)
// =============================================================================
exports.getStudentContact = async (req, res) => {
    try {
        const { id } = req.params;
        const complaint = await Complaint.findById(id).populate("studentId");
        if (!complaint) return res.status(404).json({ message: "Complaint not found" });

        const student = complaint.studentId;
        if (!student) return res.status(404).json({ message: "Student record not found" });

        const userRole = req.user.role;
        const userId = req.user.id;

        // Permissions boundary:
        // 1. Student themselves can always access their own contact details
        // 2. Wi-Fi complaints: Exclusively accessible by the authorized Wi-Fi In-Charge
        // 3. Water/Electricity/General complaints: Accessible by Wardens and Management
        const isSelf = userId === String(student._id || student.id);
        if (complaint.isAntiRagging || ["Anti-Ragging", "Anti Ragging", "Ragging"].includes(complaint.category)) {
            const isAntiRaggingAuthorized = ["MAIN_ADMIN", "INCHARGE"].includes(userRole) ||
                (req.user?.dashboardPermissions || []).includes("ANTI_RAGGING");
            if (!isAntiRaggingAuthorized) {
                return res.status(403).json({
                    message: "Access denied: Strictly confidential Anti-Ragging clearance required",
                    code: "ANTI_RAGGING_CONFIDENTIALITY_BOUNDARY"
                });
            }
        }

        const isWifiComplaint = (complaint.category === "Internet" || complaint.quickCategory === "WIFI_NOT_WORKING");

        if (isWifiComplaint) {
            if (!isSelf && userRole !== "WIFI_INCHARGE") {
                return res.status(403).json({
                    message: "Access denied: Student contact details for Wi-Fi complaints are restricted to the authorized Wi-Fi In-Charge."
                });
            }
        } else {
            const isManagement = ["MAIN_ADMIN", "WARDEN", "HEADWARDEN", "INCHARGE"].includes(userRole);
            const isAssignedStaff = userRole === "STAFF" && String(complaint.assignedTo?._id || complaint.assignedTo) === String(userId);
            if (!isSelf && !isManagement && !isAssignedStaff) {
                return res.status(403).json({
                    message: "Access denied: You are not authorized to view this student's contact details."
                });
            }

        }

        res.json({
            studentId: student._id,
            name: student.name || student.fullName,
            fullName: student.fullName || student.name,
            prn: student.prn,
            email: student.email,
            doorNumber: complaint.doorNumber || student.doorNumber,
            mobileNumber: student.mobileNumber || "Not registered"
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// =============================================================================
// GET /api/complaints/wifi/queue
// Wi-Fi In-Charge: queue of all Wi-Fi complaints with filtering
// =============================================================================
exports.getWifiQueue = async (req, res) => {
    try {
        const { status, floor, search } = req.query;
        const filter = {
            $or: [
                { category: "Internet" },
                { quickCategory: "WIFI_NOT_WORKING" }
            ]
        };

        if (status && status !== "ALL") {
            filter.status = String(status);
        }

        if (floor) {
            filter.doorNumber = { $regex: `^${floor}` };
        }

        if (search) {
            filter.$and = [
                {
                    $or: [
                        { title: { $regex: String(search), $options: "i" } },
                        { description: { $regex: String(search), $options: "i" } },
                        { doorNumber: { $regex: String(search), $options: "i" } }
                    ]
                }
            ];
        }

        // Mobile number is explicitly NOT populated in list queries to prevent leaks
        const complaints = await Complaint.find(filter)
            .populate("studentId", "name fullName email prn rollNumber classDiv year doorNumber")
            .populate("assignedTo", "name email staffRole")
            .populate("departmentId", "name code template supervisor")
            .sort({ createdAt: -1 });

        res.json(complaints);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// =============================================================================
// PUT /api/complaints/wifi/:id/status
// Wi-Fi In-Charge: update status & record progress
// =============================================================================
exports.updateWifiComplaintStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, note } = req.body;

        const allowed = ["Pending", "In Progress", "Resolved"];
        if (!status || !allowed.includes(status)) {
            return res.status(400).json({ message: `Status must be one of: ${allowed.join(", ")}` });
        }

        const complaint = await Complaint.findById(id);
        if (!complaint) return res.status(404).json({ message: "Complaint not found" });

        const cat = complaint.quickCategory || complaint.category;
        if (cat !== "WIFI_NOT_WORKING" && cat !== "Internet") {
            return res.status(400).json({ message: "This action is restricted to Wi-Fi complaints only." });
        }

        const now = new Date();
        const update = {
            status,
            $push: {
                statusHistory: {
                    status,
                    timestamp: now,
                    actor: "Wi-Fi In-Charge",
                    note: note || `Wi-Fi status updated to ${status}`
                }
            }
        };

        if (status === "Resolved") {
            update.resolvedAt = now;
            update.resolutionNote = note || "Wi-Fi issue inspected and resolved";
        }

        const updatedComplaint = await Complaint.findByIdAndUpdate(id, update, { new: true })
            .populate("studentId", "name fullName email prn rollNumber classDiv year doorNumber")
            .populate("assignedTo", "name email staffRole")
            .populate("departmentId", "name code template supervisor");

        emitComplaintStatusUpdated(updatedComplaint);
        emitServiceHeatmapUpdate({
            room: updatedComplaint.doorNumber,
            category: "Internet",
            quickCategory: "WIFI_NOT_WORKING"
        });

        res.json({
            message: "Wi-Fi complaint status updated successfully",
            complaint: updatedComplaint
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};
// =============================================================================
// POST /api/complaints/:id/reassign
// Operational Reassignment with mandatory reason and history
// =============================================================================
exports.reassignComplaint = async (req, res) => {
    try {
        const { id } = req.params;
        const { newStaffId, reason } = req.body;
        if (!reason || !reason.trim()) {
            return res.status(400).json({ message: "A mandatory reassignment reason must be provided." });
        }
        const actor = {
            id: req.user?.id || req.user?._id,
            name: req.user?.name || req.user?.role || "Management",
            role: req.user?.role || "MANAGEMENT",
            email: req.user?.email
        };
        const { reassignComplaint } = require("../services/workloadRoutingService");
        const result = await reassignComplaint({
            complaintId: id,
            newStaffId,
            reason,
            actor
        });
        res.json({ message: "Complaint reassigned successfully", ...result });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};
