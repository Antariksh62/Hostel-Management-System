const Complaint = require("../models/Complaint");
const ComplaintEvent = require("../models/ComplaintEvent");
const { broadcastNotification } = require("../services/notificationService");

/**
 * Lists active assigned jobs for the authenticated department staff member.
 * Strictly enforces Section 5.2 isolation!
 */
exports.getMyAssignedJobs = async (req, res) => {
    try {
        const staffId = req.user.id;
        const complaints = await Complaint.find({
            assignedTo: staffId,
            status: { $in: ["Pending", "In Progress", "Reopened"] },
            lifecycleState: { $nin: ["CONFIRMED", "CLOSED"] }
        })
        .populate("studentId", "name email doorNumber mobileNumber")
        .populate("departmentId", "name code")
        .sort({ priority: -1, createdAt: -1 })
        .lean();

        // Map strictly to permitted fields for employee visibility
        const sanitized = complaints.map(c => ({
            id: c._id,
            title: c.title,
            description: c.description,
            category: c.category,
            department: c.departmentId ? c.departmentId.name : "Maintenance",
            status: c.status,
            lifecycleState: c.lifecycleState || "ASSIGNED",
            doorNumber: c.doorNumber || (c.studentId ? c.studentId.doorNumber : "General"),
            studentName: c.studentId ? c.studentId.name : "Resident",
            studentPhone: c.studentId ? c.studentId.mobileNumber : "",
            assignedAt: c.assignedAt,
            acceptedAt: c.acceptedAt,
            workStartedAt: c.workStartedAt,
            escalationLevel: c.escalationLevel || 0,
            media: c.media || [],
            workNotes: c.workNotes || [],
            createdAt: c.createdAt
        }));

        res.json({ success: true, count: sanitized.length, jobs: sanitized });
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch assigned jobs", error: err.message });
    }
};

/**
 * Lists historical completed jobs for this staff member.
 */
exports.getMyWorkHistory = async (req, res) => {
    try {
        const staffId = req.user.id;
        const history = await Complaint.find({
            assignedTo: staffId,
            status: "Resolved"
        })
        .populate("studentId", "name doorNumber mobileNumber")
        .sort({ resolvedAt: -1, createdAt: -1 })
        .limit(100)
        .lean();

        const sanitized = history.map(c => ({
            id: c._id,
            title: c.title,
            description: c.description,
            category: c.category,
            doorNumber: c.doorNumber || (c.studentId ? c.studentId.doorNumber : "General"),
            studentName: c.studentId ? c.studentId.name : "Resident",
            resolvedAt: c.resolvedAt,
            resolutionNote: c.resolutionNote,
            feedback: c.feedback || null,
            createdAt: c.createdAt
        }));

        res.json({ success: true, count: sanitized.length, history: sanitized });
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch work history", error: err.message });
    }
};

/**
 * Acknowledge / Accept assignment
 */
exports.acceptJob = async (req, res) => {
    try {
        const { id } = req.params;
        const complaint = await Complaint.findOne({ _id: id, assignedTo: req.user.id });
        if (!complaint) return res.status(404).json({ message: "Complaint not found or not assigned to you." });

        const now = new Date();
        complaint.acceptedAt = now;
        complaint.lifecycleState = "ACCEPTED";
        complaint.statusHistory.push({
            status: complaint.status || "Pending",
            note: `Assignment accepted by ${req.user.name || 'Staff'}`,
            timestamp: now,
            actor: req.user.name || "Staff",
            actorId: req.user.id,
            staffId: req.user.id
        });
        await complaint.save();

        await ComplaintEvent.create({
            complaintId: complaint._id,
            eventType: "ACKNOWLEDGED",
            actor: { id: req.user.id, name: req.user.name || "Staff", role: req.user.role },
            newState: { lifecycleState: "ACCEPTED", acceptedAt: now },
            note: "Staff member acknowledged and accepted job responsibility"
        });

        res.json({ success: true, message: "Job accepted successfully", acceptedAt: now });
    } catch (err) {
        res.status(500).json({ message: "Failed to accept job", error: err.message });
    }
};

/**
 * Start Work on assigned complaint
 */
exports.startWork = async (req, res) => {
    try {
        const { id } = req.params;
        const complaint = await Complaint.findOne({ _id: id, assignedTo: req.user.id });
        if (!complaint) return res.status(404).json({ message: "Complaint not found or not assigned to you." });

        const now = new Date();
        complaint.workStartedAt = now;
        complaint.lifecycleState = "IN_PROGRESS";
        complaint.status = "In Progress";
        complaint.statusHistory.push({
            status: "In Progress",
            note: `Work commenced by ${req.user.name || 'Staff'}`,
            timestamp: now,
            actor: req.user.name || "Staff",
            actorId: req.user.id,
            staffId: req.user.id
        });
        await complaint.save();

        await ComplaintEvent.create({
            complaintId: complaint._id,
            eventType: "WORK_STARTED",
            actor: { id: req.user.id, name: req.user.name || "Staff", role: req.user.role },
            newState: { status: "In Progress", lifecycleState: "IN_PROGRESS", workStartedAt: now },
            note: "Staff began physical or technical work on the complaint"
        });

        res.json({ success: true, message: "Work started", workStartedAt: now });
    } catch (err) {
        res.status(500).json({ message: "Failed to start work", error: err.message });
    }
};

/**
 * Add work notes and photo evidence
 */
exports.addWorkNote = async (req, res) => {
    try {
        const { id } = req.params;
        const { note, attachments } = req.body;
        if (!note || !note.trim()) return res.status(400).json({ message: "Note text is required." });

        const complaint = await Complaint.findOne({ _id: id, assignedTo: req.user.id });
        if (!complaint) return res.status(404).json({ message: "Complaint not found or not assigned to you." });

        const now = new Date();
        complaint.workNotes.push({
            note: note.trim(),
            addedBy: req.user.id,
            addedByName: req.user.name || "Staff",
            addedAt: now,
            attachments: attachments || []
        });
        await complaint.save();

        await ComplaintEvent.create({
            complaintId: complaint._id,
            eventType: "NOTE_ADDED",
            actor: { id: req.user.id, name: req.user.name || "Staff", role: req.user.role },
            note: note.trim(),
            metadata: { attachmentsCount: (attachments || []).length }
        });

        res.json({ success: true, workNotes: complaint.workNotes });
    } catch (err) {
        res.status(500).json({ message: "Failed to add work note", error: err.message });
    }
};

/**
 * Mark Work Completed
 */
exports.completeWork = async (req, res) => {
    try {
        const { id } = req.params;
        const { resolutionNote, afterPhotos } = req.body;
        if (!resolutionNote || !resolutionNote.trim()) {
            return res.status(400).json({ message: "A resolution note describing the completed work is required." });
        }

        const complaint = await Complaint.findOne({ _id: id, assignedTo: req.user.id });
        if (!complaint) return res.status(404).json({ message: "Complaint not found or not assigned to you." });

        const now = new Date();
        complaint.status = "Resolved";
        complaint.lifecycleState = "AWAITING_STUDENT_CONFIRMATION";
        complaint.resolvedAt = now;
        complaint.resolutionNote = resolutionNote.trim();

        if (Array.isArray(afterPhotos) && afterPhotos.length > 0) {
            complaint.afterPhotos = afterPhotos;
        }

        complaint.statusHistory.push({
            status: "Resolved",
            note: `Work completed by ${req.user.name || 'Staff'}. Note: ${resolutionNote}`,
            timestamp: now,
            actor: req.user.name || "Staff",
            actorId: req.user.id,
            staffId: req.user.id
        });
        await complaint.save();

        await ComplaintEvent.create({
            complaintId: complaint._id,
            eventType: "WORK_COMPLETED",
            actor: { id: req.user.id, name: req.user.name || "Staff", role: req.user.role },
            newState: { status: "Resolved", lifecycleState: "AWAITING_STUDENT_CONFIRMATION", resolvedAt: now },
            note: resolutionNote.trim()
        });

        // Notify student that work is done & pending confirmation
        broadcastNotification({
            userIds: [complaint.studentId],
            type: "COMPLAINT_RESOLVED_PENDING_CONFIRMATION",
            title: "Maintenance Work Completed",
            message: `Technician completed work on "${complaint.title}". Please verify and confirm resolution.`,
            link: "/student-dashboard/complaints"
        }).catch(() => {});

        res.json({ success: true, message: "Work marked completed. Awaiting student verification.", resolvedAt: now });
    } catch (err) {
        res.status(500).json({ message: "Failed to mark work completed", error: err.message });
    }
};

/**
 * Append-only Event History for an assigned complaint
 */
exports.getComplaintTimeline = async (req, res) => {
    try {
        const { id } = req.params;
        const complaint = await Complaint.findById(id);
        if (!complaint) return res.status(404).json({ message: "Complaint not found" });

        // Isolation: If staff, must be assigned to them!
        if (req.user.role === "STAFF" && String(complaint.assignedTo) !== String(req.user.id)) {
            return res.status(403).json({ message: "Access denied: You can only view timeline for complaints assigned to you." });
        }

        const events = await ComplaintEvent.find({ complaintId: complaint._id }).sort({ timestamp: 1 }).lean();
        res.json({ success: true, count: events.length, events });
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch complaint timeline", error: err.message });
    }
};

