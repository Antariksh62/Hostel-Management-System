const mongoose = require("mongoose");
const Department = require("../models/Department");
const ComplaintCategory = require("../models/ComplaintCategory");
const { User, Staff } = require("../models/User");
const Complaint = require("../models/Complaint");
const ComplaintEvent = require("../models/ComplaintEvent");
const AuditLog = require("../models/AuditLog");
const { broadcastNotification } = require("./notificationService");

const inFlightAssignments = new Map();

function getInFlightCount(empId) {
    return inFlightAssignments.get(String(empId)) || 0;
}

function reserveInFlight(empId) {
    const k = String(empId);
    inFlightAssignments.set(k, getInFlightCount(k) + 1);
}

function releaseInFlight(empId) {
    const k = String(empId);
    const count = getInFlightCount(k);
    if (count <= 1) {
        inFlightAssignments.delete(k);
    } else {
        inFlightAssignments.set(k, count - 1);
    }
}

/**
 * Calculates current weighted workload for an employee.
 * Load = (pendingCount * weightPending) + (activeCount * 1) + (overdueCount * weightOverdue)
 */
async function calculateEmployeeWorkload(employeeId, workloadPolicy = {}) {
    const weightPending = workloadPolicy.weightPending || 1;
    const weightOverdue = workloadPolicy.weightOverdue || 2;
    const now = new Date();

    const openComplaints = await Complaint.find({
        assignedTo: employeeId,
        status: { $in: ["Pending", "In Progress", "Reopened"] },
        lifecycleState: { $nin: ["RESOLVED", "AWAITING_STUDENT_CONFIRMATION", "CONFIRMED", "CLOSED"] }
    }).select("status createdAt assignedAt escalationLevel");

    let pendingCount = 0;
    let activeCount = 0;
    let overdueCount = 0;

    for (const c of openComplaints) {
        if (c.status === "Pending") pendingCount++;
        else if (c.status === "In Progress" || c.status === "Reopened") activeCount++;

        // Overdue check (> 48 hours or escalated)
        const ageHours = (now - new Date(c.createdAt)) / (1000 * 60 * 60);
        if (ageHours > 48 || c.escalationLevel > 0) {
            overdueCount++;
        }
    }

    const inFlight = getInFlightCount(employeeId);
    const totalScore = (pendingCount * weightPending) + (activeCount * 1) + (overdueCount * weightOverdue) + (inFlight * 2);

    return {
        totalScore,
        activeCount: openComplaints.length + inFlight,
        pendingCount,
        overdueCount
    };
}

let routingLock = Promise.resolve();

/**
 * Automatically routes and assigns a complaint to an eligible active employee in the department.
 */
async function _doRouteAndAssign({ complaintId, selectedCategory, studentId, actor = { name: "System", role: "SYSTEM" } }) {
    const complaint = await Complaint.findById(complaintId);
    if (!complaint) throw new Error("Complaint not found");

    if (complaint.status === "Resolved") {
        throw new Error("Cannot route or assign a complaint that is already Resolved. Please reopen the complaint first if further maintenance is required.");
    }

    // 1. Resolve Target Department
    let department = null;
    let categoryDoc = await ComplaintCategory.findOne({
        name: { $regex: new RegExp(`^${selectedCategory}$`, "i") },
        isActive: true
    }).populate("departmentId");

    if (categoryDoc && categoryDoc.departmentId && categoryDoc.departmentId.isActive !== false) {
        department = categoryDoc.departmentId;
    } else {
        // Fallback matching by active department complaintCategories or code/name
        const catUpper = String(selectedCategory || "").toUpperCase();
        let queryCode = null;
        if (catUpper.includes("PLUMB") || catUpper.includes("WATER") || catUpper.includes("TAP") || catUpper.includes("LEAK")) {
            queryCode = "PLUMBING";
        } else if (catUpper.includes("ELECT") || catUpper.includes("FAN") || catUpper.includes("SWITCH") || catUpper.includes("LIGHT") || catUpper.includes("POWER")) {
            queryCode = "ELECTRICAL";
        } else if (catUpper.includes("FURN") || catUpper.includes("WORKSHOP") || catUpper.includes("TABLE") || catUpper.includes("BED") || catUpper.includes("DOOR") || catUpper.includes("CARPENT")) {
            queryCode = "WORKSHOP";
        } else if (catUpper.includes("CLEAN") || catUpper.includes("HYGIENE") || catUpper.includes("WASHROOM") || catUpper.includes("CORRIDOR") || catUpper.includes("SWEEP")) {
            queryCode = "CLEANING";
        } else if (catUpper.includes("WIFI") || catUpper.includes("INTERNET") || catUpper.includes("NETWORK") || catUpper.includes("ROUTER")) {
            queryCode = "WIFI";
        } else if (catUpper.includes("SECURITY") || catUpper.includes("GUARD") || catUpper.includes("THEFT") || catUpper.includes("GATE")) {
            queryCode = "SECURITY";
        } else if (catUpper.includes("RAGGING") || catUpper.includes("HARASS")) {
            queryCode = "ANTI_RAGGING";
        }

        if (queryCode) {
            department = await Department.findOne({ code: queryCode, isActive: true });
        }
    }

    // If no active department is configured for this category, route to Management Review Queue
    if (!department) {
        complaint.departmentId = null;
        complaint.lifecycleState = "SUBMITTED";
        complaint.status = "Pending";
        complaint.statusHistory.push({
            status: "Pending",
            note: `No active department mapping configured for category '${selectedCategory}'. Routed to Management Review Queue.`,
            timestamp: new Date(),
            actor: "System Router"
        });
        await complaint.save();

        await ComplaintEvent.create({
            complaintId: complaint._id,
            eventType: "ROUTED",
            actor: { name: "System Workload Router", role: "SYSTEM" },
            note: `No configured department mapping for '${selectedCategory}'. Placed in Management Review Queue.`
        });

        broadcastNotification({
            roles: ["WARDEN", "HEADWARDEN", "INCHARGE", "MAIN_ADMIN"],
            type: "UNROUTED_COMPLAINT_MANAGEMENT_REVIEW",
            title: "Complaint in Management Review",
            message: `Complaint #${complaint._id.toString().slice(-6)} has no configured department mapping for category "${selectedCategory}". Management review required.`,
            link: "/admin-dashboard?tab=complaints"
        }).catch(() => {});

        return {
            success: true,
            status: "MANAGEMENT_REVIEW",
            department: null,
            assignedEmployee: null,
            message: "No configured department mapping. Placed in Management Review Queue."
        };
    }

    complaint.departmentId = department._id;
    if (department.code === "ANTI_RAGGING") {
        complaint.isConfidential = true;
        complaint.isAntiRagging = true;
    }
    if (department.code === "SECURITY") {
        complaint.isSecurity = true;
    }

    // Append ROUTED event
    await ComplaintEvent.create({
        complaintId: complaint._id,
        eventType: "ROUTED",
        actor,
        newState: { departmentId: department._id, departmentCode: department.code, departmentName: department.name },
        note: `Complaint automatically routed to ${department.name} department based on category '${selectedCategory}'`
    });

    complaint.statusHistory.push({
        status: "Pending",
        note: `Complaint automatically routed to ${department.name} department`,
        timestamp: new Date(),
        actor: "System Router"
    });

    // 2. Department routing vs individual staff assignment:
    // By default, complaints are routed to the department unassigned queue where department supervisors
    // or authorized staff can assign or claim them. Automatic individual assignment is only performed if
    // the department's workloadPolicy explicitly specifies autoAssignIndividual: true.
    const autoAssign = Boolean(department.workloadPolicy && department.workloadPolicy.autoAssignIndividual);

    if (!autoAssign) {
        complaint.assignedTo = null;
        complaint.lifecycleState = "ROUTED";
        complaint.status = "Pending";
        await complaint.save();

        await ComplaintEvent.create({
            complaintId: complaint._id,
            eventType: "ROUTED",
            actor: { name: "System Workload Router", role: "SYSTEM" },
            note: `Complaint routed to ${department.name} department queue. Awaiting supervisor or staff assignment.`
        });

        return {
            success: true,
            status: "ROUTED_TO_DEPARTMENT",
            department: department.name,
            assignedEmployee: null,
            message: `Routed to ${department.name} department queue.`
        };
    }

    // 3. Find eligible, active, available employees (when autoAssignIndividual is enabled)
    const query = {
        role: { $in: ["STAFF", "WIFI_INCHARGE"] },
        isActive: true,
        isAvailable: true,
        $or: [
            { departmentId: department._id },
            { authorizedDepartments: department._id },
            { dashboardPermissions: department.code },
            { staffRole: new RegExp(department.name, "i") }
        ]
    };

    // If Anti-Ragging, strictly check ANTI_RAGGING dashboard permission
    if (department.code === "ANTI_RAGGING") {
        query.dashboardPermissions = "ANTI_RAGGING";
    }

    const eligibleEmployees = await User.find(query);

    // 3. Workload Balancing Selection
    if (eligibleEmployees.length === 0) {
        // No available employee -> Department Unassigned Exception Queue
        complaint.assignedTo = null;
        complaint.lifecycleState = "ROUTED";
        await complaint.save();

        await ComplaintEvent.create({
            complaintId: complaint._id,
            eventType: "ROUTED",
            actor: { name: "System Workload Router", role: "SYSTEM" },
            note: `No available employees in ${department.name}. Placed in department unassigned exception queue.`
        });

        // Broadcast warning to management
        broadcastNotification({
            roles: ["WARDEN", "HEADWARDEN", "INCHARGE", "MAIN_ADMIN"],
            type: "UNASSIGNED_COMPLAINT_EXCEPTION",
            title: `Unassigned Complaint in ${department.name}`,
            message: `Complaint #${complaint._id.toString().slice(-6)} has no available staff in ${department.name}. Immediate management attention required.`,
            link: `/admin-dashboard?tab=complaints&dept=${department.code}`
        }).catch(() => {});

        return {
            success: true,
            status: "QUEUED_UNASSIGNED",
            department: department.name,
            assignedEmployee: null,
            message: "No available staff. Placed in department unassigned exception queue."
        };
    }

    // Calculate workload score for each eligible candidate
    const candidateScores = [];
    for (const emp of eligibleEmployees) {
        const stats = await calculateEmployeeWorkload(emp._id, department.workloadPolicy);
        candidateScores.push({
            employee: emp,
            score: stats.totalScore,
            activeCount: stats.activeCount
        });
    }

    // Sort by lowest score, then lowest active count
    candidateScores.sort((a, b) => a.score - b.score || a.activeCount - b.activeCount);
    const chosenCandidate = candidateScores[0].employee;
    const now = new Date();

    // Reserve in-flight slot for concurrency safety
    reserveInFlight(chosenCandidate._id);

    try {
        // 4. Atomic Assignment
        complaint.assignedTo = chosenCandidate._id;
        complaint.assignedAt = now;
        complaint.lifecycleState = "ASSIGNED";
        complaint.status = "Pending";
        complaint.statusHistory.push({
            status: "Pending",
            note: `Automatically assigned to ${chosenCandidate.name} (${department.name})`,
            timestamp: now,
            actor: "Workload Router",
            staffId: chosenCandidate._id
        });
        await complaint.save();
    } finally {
        releaseInFlight(chosenCandidate._id);
    }

    // 5. Append ASSIGNED event
    await ComplaintEvent.create({
        complaintId: complaint._id,
        eventType: "ASSIGNED",
        actor: { name: "System Workload Router", role: "SYSTEM" },
        newState: {
            assignedTo: chosenCandidate._id,
            assignedName: chosenCandidate.name,
            assignedAt: now,
            workloadScore: candidateScores[0].score
        },
        note: `Assigned to ${chosenCandidate.name} via least-active workload balancing (Score: ${candidateScores[0].score})`
    });

    // 6. Notify assigned employee
    broadcastNotification({
        userIds: [chosenCandidate._id],
        type: "NEW_ASSIGNMENT",
        title: "New Job Assigned",
        message: `You have been assigned complaint in Room ${complaint.doorNumber || "General"}: ${complaint.title}`,
        link: "/staff-dashboard"
    }).catch(() => {});

    return {
        success: true,
        status: "ASSIGNED",
        department: department.name,
        assignedEmployee: {
            id: chosenCandidate._id,
            name: chosenCandidate.name,
            email: chosenCandidate.email
        },
        workloadScore: candidateScores[0].score
    };
}

async function routeAndAssignComplaint(params) {
    const nextInQueue = () => _doRouteAndAssign(params);
    const execution = routingLock.then(nextInQueue, nextInQueue);
    routingLock = execution.catch(() => {});
    return execution;
}

/**
 * Operational manual reassignment with reason and full audit trail.
 */
async function reassignComplaint({ complaintId, newStaffId, reason, actor }) {
    if (!reason || !reason.trim()) {
        throw new Error("A mandatory reassignment reason must be provided.");
    }

    const complaint = await Complaint.findById(complaintId);
    if (!complaint) throw new Error("Complaint not found");

    if (complaint.status === "Resolved") {
        throw new Error("Cannot reassign a complaint that is already Resolved. Please reopen the complaint first if further maintenance is required.");
    }

    const newStaff = await User.findById(newStaffId);
    if (!newStaff || !["STAFF", "WIFI_INCHARGE"].includes(newStaff.role)) {
        throw new Error("Target user is not a valid staff member.");
    }

    const prevStaffId = complaint.assignedTo;
    const prevStaff = prevStaffId ? await User.findById(prevStaffId) : null;
    const now = new Date();

    complaint.assignedTo = newStaff._id;
    complaint.assignedAt = now;
    complaint.reassignmentHistory.push({
        previousStaff: prevStaffId,
        newStaff: newStaff._id,
        reason: reason.trim(),
        reassignedBy: actor.id,
        reassignedByRole: actor.role,
        timestamp: now
    });
    complaint.statusHistory.push({
        status: complaint.status || "Pending",
        note: `Reassigned from ${prevStaff ? prevStaff.name : 'Unassigned'} to ${newStaff.name}. Reason: ${reason}`,
        timestamp: now,
        actor: actor.name,
        actorId: actor.id,
        staffId: newStaff._id
    });
    await complaint.save();

    // Event History
    await ComplaintEvent.create({
        complaintId: complaint._id,
        eventType: "REASSIGNED",
        actor: { id: actor.id, name: actor.name, role: actor.role },
        previousState: { assignedTo: prevStaffId, staffName: prevStaff ? prevStaff.name : "None" },
        newState: { assignedTo: newStaff._id, staffName: newStaff.name },
        note: reason.trim()
    });

    // Audit Log
    await AuditLog.create({
        action: "COMPLAINT_REASSIGNED",
        performedBy: { id: actor.id, name: actor.name, role: actor.role, email: actor.email },
        target: { id: complaint._id, model: "Complaint", identifier: complaint.title },
        details: {
            previousStaff: prevStaff ? prevStaff.name : "Unassigned",
            newStaff: newStaff.name,
            reason: reason.trim()
        }
    });

    // Notify new staff
    broadcastNotification({
        userIds: [newStaff._id],
        type: "REASSIGNED_JOB",
        title: "Work Reassigned to You",
        message: `You have been reassigned complaint: ${complaint.title}. Reason: ${reason}`,
        link: "/staff-dashboard"
    }).catch(() => {});

    return {
        success: true,
        previousStaff: prevStaff ? prevStaff.name : "None",
        newStaff: newStaff.name,
        reassignedAt: now
    };
}

module.exports = {
    calculateEmployeeWorkload,
    routeAndAssignComplaint,
    reassignComplaint
};

