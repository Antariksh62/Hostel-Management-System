const Complaint = require("../models/Complaint");
const ComplaintEvent = require("../models/ComplaintEvent");
const AuditLog = require("../models/AuditLog");
const Department = require("../models/Department");
const { User } = require("../models/User");
const { broadcastNotification } = require("../services/notificationService");
const { emitComplaintAssigned, emitComplaintStatusUpdated } = require("../socket");

/**
 * Returns department info, supervisor status, and team summary for authenticated staff.
 */
exports.getMyDepartmentInfo = async (req, res) => {
    try {
        const staff = await User.findById(req.user.id).populate("departmentId", "name code description template complaintCategories supervisor").lean();
        if (!staff) return res.status(404).json({ message: "Staff user not found" });

        let department = staff.departmentId;

        // Fallback: match by staffRole or permissions if not directly assigned
        if (!department) {
            const roleMatch = staff.staffRole || "";
            if (roleMatch.match(/plumb/i)) department = await Department.findOne({ code: "PLUMBING" }).lean();
            else if (roleMatch.match(/elect/i)) department = await Department.findOne({ code: "ELECTRICAL" }).lean();
            else if (roleMatch.match(/carpent|furn|work/i)) department = await Department.findOne({ code: "WORKSHOP" }).lean();
            else if (roleMatch.match(/clean|house/i)) department = await Department.findOne({ code: "CLEANING" }).lean();
            else if (roleMatch.match(/secur/i)) department = await Department.findOne({ code: "SECURITY" }).lean();
            else if (roleMatch.match(/ragging/i)) department = await Department.findOne({ code: "ANTI_RAGGING" }).lean();
            else if (staff.role === "WIFI_INCHARGE") department = await Department.findOne({ code: "WIFI" }).lean();
        }

        if (!department) {
            return res.json({
                success: true,
                department: {
                    name: "General Maintenance",
                    code: "GENERAL",
                    description: "General hostel facility support",
                    complaintCategories: ["General", "Other"]
                },
                isSupervisor: Boolean(staff.isSupervisor),
                supervisor: null,
                colleaguesCount: 0
            });
        }

        const supervisorUser = department.supervisor ? await User.findById(department.supervisor, "name email staffRole designation phoneNumber").lean() : null;
        const colleaguesCount = await User.countDocuments({
            role: { $in: ["STAFF", "WIFI_INCHARGE"] },
            $or: [{ departmentId: department._id }, { authorizedDepartments: department._id }],
            isActive: true
        });

        res.json({
            success: true,
            department: {
                id: department._id,
                name: department.name,
                code: department.code,
                description: department.description,
                template: department.template,
                complaintCategories: department.complaintCategories || []
            },
            isSupervisor: Boolean(staff.isSupervisor) || (supervisorUser && String(supervisorUser._id) === String(staff._id)),
            supervisor: supervisorUser ? {
                id: supervisorUser._id,
                name: supervisorUser.name,
                email: supervisorUser.email,
                designation: supervisorUser.designation || supervisorUser.staffRole,
                phoneNumber: supervisorUser.phoneNumber
            } : null,
            colleaguesCount
        });
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch department info", error: err.message });
    }
};

/**
 * Returns complaints for the authenticated staff member's department.
 * Supports filters: status (all, Pending, In Progress, Resolved), scope (all, my_jobs, unassigned).
 */
exports.getDepartmentComplaints = async (req, res) => {
    try {
        const staff = await User.findById(req.user.id).lean();
        if (!staff) return res.status(404).json({ message: "Staff user not found" });

        const { status, scope, search } = req.query;

        let deptId = staff.departmentId;
        if (!deptId) {
            const roleMatch = staff.staffRole || "";
            let deptDoc = null;
            if (roleMatch.match(/plumb/i)) deptDoc = await Department.findOne({ code: "PLUMBING" });
            else if (roleMatch.match(/elect/i)) deptDoc = await Department.findOne({ code: "ELECTRICAL" });
            else if (roleMatch.match(/carpent|furn|work/i)) deptDoc = await Department.findOne({ code: "WORKSHOP" });
            else if (roleMatch.match(/clean|house/i)) deptDoc = await Department.findOne({ code: "CLEANING" });
            else if (roleMatch.match(/secur/i)) deptDoc = await Department.findOne({ code: "SECURITY" });
            else if (roleMatch.match(/ragging/i)) deptDoc = await Department.findOne({ code: "ANTI_RAGGING" });
            else if (staff.role === "WIFI_INCHARGE") deptDoc = await Department.findOne({ code: "WIFI" });
            if (deptDoc) deptId = deptDoc._id;
        }

        const filter = {};

        // Department isolation: Only complaints belonging to this staff's department(s)
        if (deptId) {
            const authorizedIds = [deptId, ...(staff.authorizedDepartments || [])];
            filter.departmentId = { $in: authorizedIds };
        } else {
            filter.assignedTo = staff._id;
        }

        // Anti-Ragging isolation barrier
        const antiRaggingDept = await Department.findOne({ code: "ANTI_RAGGING" });
        const isAntiRaggingAuthorized = ["MAIN_ADMIN", "INCHARGE"].includes(req.user.role) ||
            (staff.dashboardPermissions || []).includes("ANTI_RAGGING") ||
            (deptId && antiRaggingDept && String(deptId) === String(antiRaggingDept._id));

        if (!isAntiRaggingAuthorized) {
            filter.isAntiRagging = { $ne: true };
            filter.isConfidential = { $ne: true };
            if (antiRaggingDept) {
                if (filter.departmentId && typeof filter.departmentId === "object" && filter.departmentId.$in) {
                    filter.departmentId.$in = filter.departmentId.$in.filter(d => String(d) !== String(antiRaggingDept._id));
                } else {
                    filter.departmentId = { $ne: antiRaggingDept._id };
                }
            }
        }

        // Scope filter
        if (scope === "my_jobs") {
            filter.assignedTo = staff._id;
        } else if (scope === "unassigned") {
            filter.assignedTo = null;
            filter.status = { $in: ["Pending", "In Progress"] };
        }

        // Status filter
        if (status && status !== "all") {
            filter.status = status;
        }

        if (search) {
            filter.$or = [
                { title: { $regex: String(search), $options: "i" } },
                { description: { $regex: String(search), $options: "i" } },
                { doorNumber: { $regex: String(search), $options: "i" } }
            ];
        }

        const complaints = await Complaint.find(filter)
            .populate("studentId", "name email doorNumber mobileNumber")
            .populate("assignedTo", "name email staffRole designation")
            .populate("departmentId", "name code")
            .sort({ priority: -1, createdAt: -1 })
            .lean();

        const sanitized = complaints.map(c => ({
            id: c._id,
            _id: c._id,
            title: c.title,
            description: c.description,
            category: c.category,
            department: c.departmentId ? c.departmentId.name : "Maintenance",
            departmentCode: c.departmentId ? c.departmentId.code : "GENERAL",
            status: c.status,
            lifecycleState: c.lifecycleState || "ROUTED",
            doorNumber: c.doorNumber || (c.studentId ? c.studentId.doorNumber : "General"),
            studentName: c.studentId ? c.studentId.name : "Resident",
            studentPhone: c.studentId ? c.studentId.mobileNumber : "",
            assignedTo: c.assignedTo ? {
                id: c.assignedTo._id,
                _id: c.assignedTo._id,
                name: c.assignedTo.name,
                email: c.assignedTo.email,
                designation: c.assignedTo.designation || c.assignedTo.staffRole
            } : null,
            assignedAt: c.assignedAt,
            acceptedAt: c.acceptedAt,
            workStartedAt: c.workStartedAt,
            resolvedAt: c.resolvedAt,
            resolutionNote: c.resolutionNote,
            escalationLevel: c.escalationLevel || 0,
            media: c.media || [],
            workNotes: c.workNotes || [],
            feedback: c.feedback || null,
            createdAt: c.createdAt
        }));

        res.json({ success: true, count: sanitized.length, complaints: sanitized });
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch department complaints", error: err.message });
    }
};

/**
 * Lists colleagues in the same department (for assignment by supervisor).
 */
exports.getDepartmentColleagues = async (req, res) => {
    try {
        const staff = await User.findById(req.user.id).lean();
        if (!staff) return res.status(404).json({ message: "Staff user not found" });

        const deptId = staff.departmentId;
        if (!deptId) return res.json({ success: true, colleagues: [] });

        const colleagues = await User.find({
            role: { $in: ["STAFF", "WIFI_INCHARGE"] },
            $or: [{ departmentId: deptId }, { authorizedDepartments: deptId }],
            isActive: true
        }, "name email staffRole designation employeeId phoneNumber isAvailable isSupervisor").lean();

        res.json({
            success: true,
            colleagues: colleagues.map(c => ({
                id: c._id,
                _id: c._id,
                name: c.name,
                email: c.email,
                designation: c.designation || c.staffRole || "Staff",
                employeeId: c.employeeId || "",
                phoneNumber: c.phoneNumber || "",
                isAvailable: c.isAvailable !== false,
                isSupervisor: Boolean(c.isSupervisor)
            }))
        });
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch colleagues", error: err.message });
    }
};

/**
 * Claim an unassigned complaint in the staff member's department.
 */
exports.claimComplaint = async (req, res) => {
    try {
        const { id } = req.params;
        const staff = await User.findById(req.user.id);
        if (!staff) return res.status(404).json({ message: "Staff user not found" });

        const complaint = await Complaint.findById(id);
        if (!complaint) return res.status(404).json({ message: "Complaint not found" });

        // Ensure complaint belongs to staff member's department
        const authorizedDeptIds = [String(staff.departmentId), ...(staff.authorizedDepartments || []).map(String)];
        if (complaint.departmentId && !authorizedDeptIds.includes(String(complaint.departmentId))) {
            return res.status(403).json({ message: "Access denied: This complaint does not belong to your department." });
        }

        if (complaint.assignedTo && String(complaint.assignedTo) !== String(staff._id) && !staff.isSupervisor) {
            return res.status(400).json({ message: "Complaint is already assigned to another staff member." });
        }

        const now = new Date();
        complaint.assignedTo = staff._id;
        complaint.assignedAt = now;
        complaint.lifecycleState = "ASSIGNED";
        complaint.status = "In Progress";
        complaint.statusHistory.push({
            status: "In Progress",
            note: `Claimed and assigned to ${staff.name}`,
            timestamp: now,
            actor: staff.name,
            actorId: staff._id,
            staffId: staff._id
        });
        await complaint.save();

        await ComplaintEvent.create({
            complaintId: complaint._id,
            eventType: "ASSIGNED",
            actor: { id: staff._id, name: staff.name, role: staff.role },
            newState: { assignedTo: staff._id, staffName: staff.name, status: "In Progress" },
            note: `Staff member ${staff.name} claimed complaint for resolution`
        });

        const populatedComplaint = await Complaint.findById(complaint._id)
            .populate("studentId", "name fullName email doorNumber mobileNumber")
            .populate("assignedTo", "name email staffRole designation")
            .populate("departmentId", "name code");

        emitComplaintAssigned(populatedComplaint || complaint);
        emitComplaintStatusUpdated(populatedComplaint || complaint);

        res.json({ success: true, message: "Job claimed successfully", complaint: populatedComplaint || complaint });
    } catch (err) {
        res.status(500).json({ message: "Failed to claim job", error: err.message });
    }
};

/**
 * Assign a department complaint to a colleague (Supervisor or Management action).
 */
exports.assignDepartmentComplaint = async (req, res) => {
    try {
        const { id } = req.params;
        const { staffId, reason } = req.body;

        if (!staffId) return res.status(400).json({ message: "Target staffId is required." });

        const caller = await User.findById(req.user.id);
        const targetStaff = await User.findById(staffId);
        if (!targetStaff || !["STAFF", "WIFI_INCHARGE"].includes(targetStaff.role)) {
            return res.status(404).json({ message: "Target staff member not found." });
        }

        const isManagement = ["MAIN_ADMIN", "INCHARGE", "WARDEN", "HEADWARDEN"].includes(caller.role);
        const isSupervisor = Boolean(caller.isSupervisor);

        if (!isManagement && !isSupervisor) {
            return res.status(403).json({ message: "Access denied: Department supervisor or management privileges required to assign jobs." });
        }

        const complaint = await Complaint.findById(id);
        if (!complaint) return res.status(404).json({ message: "Complaint not found" });

        const now = new Date();
        const prevStaffId = complaint.assignedTo;
        complaint.assignedTo = targetStaff._id;
        complaint.assignedAt = now;
        complaint.lifecycleState = "ASSIGNED";
        complaint.status = "In Progress";

        const noteText = prevStaffId
            ? `Reassigned by supervisor ${caller.name} to ${targetStaff.name}. Reason: ${reason || 'Operational assignment'}`
            : `Assigned by supervisor ${caller.name} to ${targetStaff.name}`;

        complaint.statusHistory.push({
            status: "In Progress",
            note: noteText,
            timestamp: now,
            actor: caller.name,
            actorId: caller._id,
            staffId: targetStaff._id
        });
        await complaint.save();

        await ComplaintEvent.create({
            complaintId: complaint._id,
            eventType: prevStaffId ? "REASSIGNED" : "ASSIGNED",
            actor: { id: caller._id, name: caller.name, role: caller.role },
            newState: { assignedTo: targetStaff._id, staffName: targetStaff.name },
            note: noteText
        });

        const populatedComplaint = await Complaint.findById(complaint._id)
            .populate("studentId", "name fullName email doorNumber mobileNumber")
            .populate("assignedTo", "name email staffRole designation")
            .populate("departmentId", "name code");

        emitComplaintAssigned(populatedComplaint || complaint);
        emitComplaintStatusUpdated(populatedComplaint || complaint);

        // Notify assigned staff
        broadcastNotification({
            userIds: [targetStaff._id],
            type: "NEW_ASSIGNMENT",
            title: "New Job Assigned by Supervisor",
            message: `Supervisor ${caller.name} assigned you to: ${complaint.title}`,
            link: "/staff-dashboard"
        }).catch(() => {});

        res.json({ success: true, message: `Assigned to ${targetStaff.name}`, complaint: populatedComplaint || complaint });
    } catch (err) {
        res.status(500).json({ message: "Failed to assign complaint", error: err.message });
    }
};

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

        const popComplaint = await Complaint.findById(complaint._id)
            .populate("studentId", "name fullName email doorNumber mobileNumber")
            .populate("assignedTo", "name email staffRole designation")
            .populate("departmentId", "name code");
        emitComplaintStatusUpdated(popComplaint || complaint);

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

        const popComplaint = await Complaint.findById(complaint._id)
            .populate("studentId", "name fullName email doorNumber mobileNumber")
            .populate("assignedTo", "name email staffRole designation")
            .populate("departmentId", "name code");
        emitComplaintStatusUpdated(popComplaint || complaint);

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
        const resolutionNote = (req.body.resolutionNote || req.body.resolutionNotes || "").trim();
        const afterPhotos = req.body.afterPhotos;
        if (!resolutionNote) {
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

        await AuditLog.create({
            action: "COMPLAINT_RESOLVED",
            performedBy: { id: req.user.id, name: req.user.name || "Staff", role: req.user.role, email: req.user.email || "" },
            target: { id: complaint._id, model: "Complaint", identifier: complaint.title },
            details: { resolutionNote: resolutionNote.trim(), outcome: "SUCCESS" }
        }).catch(e => console.error("AuditLog error:", e.message));

        // Notify student that work is done & pending confirmation
        broadcastNotification({
            userIds: [complaint.studentId],
            type: "COMPLAINT_RESOLVED_PENDING_CONFIRMATION",
            title: "Maintenance Work Completed",
            message: `Technician completed work on "${complaint.title}". Please verify and confirm resolution.`,
            link: "/student-dashboard/complaints"
        }).catch(() => {});

        const popComplaint = await Complaint.findById(complaint._id)
            .populate("studentId", "name fullName email doorNumber mobileNumber")
            .populate("assignedTo", "name email staffRole designation")
            .populate("departmentId", "name code");
        emitComplaintStatusUpdated(popComplaint || complaint);

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

