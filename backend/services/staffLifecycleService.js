const bcrypt = require("bcryptjs");
const { User, Staff } = require("../models/User");
const Department = require("../models/Department");
const { DashboardInstance } = require("../models/DashboardInstance");
const Complaint = require("../models/Complaint");
const ComplaintEvent = require("../models/ComplaintEvent");
const AuditLog = require("../models/AuditLog");
const { broadcastNotification } = require("./notificationService");

/**
 * Creates a new staff/employee account.
 * MAIN_ADMIN can create any account.
 * INCHARGE can only create operational staff accounts (PLUMBING, ELECTRICAL, WORKSHOP, CLEANING, WIFI).
 */
async function createStaffAccount({
    name,
    email,
    password,
    role = "STAFF",
    staffRole,
    designation,
    employeeId = "",
    phoneNumber = "",
    departmentId,
    authorizedDepartments = [],
    isSupervisor = false,
    dashboardPermissions = [],
    actor
}) {
    if (!name || !email || !password) {
        throw new Error("Name, email and password are required.");
    }

    // Role boundaries: INCHARGE can only create operational STAFF
    if (actor.role === "INCHARGE") {
        if (role !== "STAFF") {
            throw new Error("Hostel In-Charge is only authorized to manage operational staff accounts.");
        }
        // Ensure INCHARGE is not assigning MAIN_ADMIN or ANTI_RAGGING permissions
        if (dashboardPermissions.includes("MAIN_ADMIN") || dashboardPermissions.includes("ANTI_RAGGING")) {
            throw new Error("Hostel In-Charge cannot assign administrative or Anti-Ragging privileges.");
        }
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
        throw new Error(`An account with email '${cleanEmail}' already exists.`);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const finalDesignation = designation || staffRole || "Technician";

    const newStaff = await Staff.create({
        name: name.trim(),
        email: cleanEmail,
        password: hashedPassword,
        role: role === "WIFI_INCHARGE" ? "WIFI_INCHARGE" : "STAFF",
        staffRole: finalDesignation,
        designation: finalDesignation,
        employeeId: employeeId ? employeeId.trim() : "",
        phoneNumber: phoneNumber ? phoneNumber.trim() : "",
        departmentId: departmentId || null,
        authorizedDepartments: Array.isArray(authorizedDepartments) ? authorizedDepartments : [],
        isSupervisor: Boolean(isSupervisor),
        dashboardPermissions,
        isActive: true,
        isAvailable: true
    });

    // If marked as supervisor for department, update Department record
    if (isSupervisor && departmentId) {
        await Department.findByIdAndUpdate(departmentId, { supervisor: newStaff._id });
    }

    // Record Audit Log
    await AuditLog.create({
        action: "STAFF_CREATED",
        performedBy: { id: actor.id, name: actor.name, role: actor.role, email: actor.email },
        target: { id: newStaff._id, model: "User", identifier: newStaff.email },
        details: {
            role: newStaff.role,
            staffRole: newStaff.staffRole,
            designation: newStaff.designation,
            employeeId: newStaff.employeeId,
            departmentId: newStaff.departmentId,
            isSupervisor: newStaff.isSupervisor,
            permissions: dashboardPermissions
        }
    });

    return {
        id: newStaff._id,
        name: newStaff.name,
        email: newStaff.email,
        role: newStaff.role,
        staffRole: newStaff.staffRole,
        designation: newStaff.designation,
        employeeId: newStaff.employeeId,
        phoneNumber: newStaff.phoneNumber,
        departmentId: newStaff.departmentId,
        authorizedDepartments: newStaff.authorizedDepartments,
        isSupervisor: newStaff.isSupervisor,
        dashboardPermissions: newStaff.dashboardPermissions
    };
}

/**
 * Updates staff account profile and operational assignment details.
 */
async function updateStaffAccount({
    staffId,
    name,
    email,
    employeeId,
    phoneNumber,
    designation,
    staffRole,
    departmentId,
    authorizedDepartments,
    isSupervisor,
    actor
}) {
    const staff = await User.findById(staffId);
    if (!staff) throw new Error("Staff member not found");

    if (actor.role === "INCHARGE" && (staff.role === "HEADWARDEN" || staff.role === "MAIN_ADMIN")) {
        throw new Error("Unauthorized to modify elevated administrative accounts.");
    }

    if (name) staff.name = name.trim();
    if (email) {
        const cleanEmail = email.trim().toLowerCase();
        if (cleanEmail !== staff.email) {
            const exists = await User.findOne({ email: cleanEmail, _id: { $ne: staff._id } });
            if (exists) throw new Error(`An account with email '${cleanEmail}' already exists.`);
            staff.email = cleanEmail;
        }
    }

    if (employeeId !== undefined) staff.employeeId = employeeId.trim();
    if (phoneNumber !== undefined) staff.phoneNumber = phoneNumber.trim();

    const newDesignation = designation || staffRole;
    if (newDesignation) {
        staff.designation = newDesignation.trim();
        staff.staffRole = newDesignation.trim();
    }

    if (departmentId !== undefined) staff.departmentId = departmentId || null;
    if (authorizedDepartments !== undefined) {
        staff.authorizedDepartments = Array.isArray(authorizedDepartments) ? authorizedDepartments : [];
    }

    if (isSupervisor !== undefined) {
        staff.isSupervisor = Boolean(isSupervisor);
        if (staff.isSupervisor && staff.departmentId) {
            await Department.findByIdAndUpdate(staff.departmentId, { supervisor: staff._id });
        }
    }

    await staff.save();

    await AuditLog.create({
        action: "STAFF_UPDATED",
        performedBy: { id: actor.id, name: actor.name, role: actor.role, email: actor.email },
        target: { id: staff._id, model: "User", identifier: staff.email },
        details: {
            name: staff.name,
            designation: staff.designation,
            departmentId: staff.departmentId,
            isSupervisor: staff.isSupervisor
        }
    });

    return {
        id: staff._id,
        name: staff.name,
        email: staff.email,
        role: staff.role,
        designation: staff.designation,
        employeeId: staff.employeeId,
        phoneNumber: staff.phoneNumber,
        departmentId: staff.departmentId,
        authorizedDepartments: staff.authorizedDepartments,
        isSupervisor: staff.isSupervisor,
        dashboardPermissions: staff.dashboardPermissions,
        isActive: staff.isActive
    };
}

/**
 * Resets a staff member's password securely with bcrypt.
 */
async function resetStaffPassword({ staffId, newPassword, actor }) {
    if (!newPassword || newPassword.length < 6) {
        throw new Error("New password must be at least 6 characters long.");
    }

    const staff = await User.findById(staffId);
    if (!staff) throw new Error("Staff member not found");

    if (actor.role === "INCHARGE" && (staff.role === "HEADWARDEN" || staff.role === "MAIN_ADMIN")) {
        throw new Error("Unauthorized to reset elevated administrator passwords.");
    }

    const salt = await bcrypt.genSalt(10);
    staff.password = await bcrypt.hash(newPassword, salt);
    await staff.save();

    await AuditLog.create({
        action: "STAFF_PASSWORD_RESET",
        performedBy: { id: actor.id, name: actor.name, role: actor.role, email: actor.email },
        target: { id: staff._id, model: "User", identifier: staff.email },
        details: { note: "Password reset by administrator" }
    });

    return { success: true, message: `Password reset successfully for ${staff.name}` };
}

/**
 * Deactivates a staff account, invalidating future logins and tracking open jobs.
 */
async function deactivateStaffAccount({ staffId, reason = "Departing / Inactive", reallocateWork = false, actor }) {
    const staff = await User.findById(staffId);
    if (!staff) throw new Error("Staff member not found");

    if (staff.role === "MAIN_ADMIN") {
        throw new Error("Main System Administrator account cannot be deactivated.");
    }

    if (actor.role === "INCHARGE" && (staff.role === "HEADWARDEN" || staff.role === "WARDEN" || staff.role === "MAIN_ADMIN")) {
        throw new Error("Hostel In-Charge can only manage operational staff.");
    }

    staff.isActive = false;
    staff.isAvailable = false;
    staff.availabilityReason = `Deactivated: ${reason}`;
    await staff.save();

    // Query open unfinished assignments
    const openComplaints = await Complaint.find({
        assignedTo: staff._id,
        status: { $in: ["Pending", "In Progress", "Reopened"] },
        lifecycleState: { $nin: ["RESOLVED", "AWAITING_STUDENT_CONFIRMATION", "CONFIRMED", "CLOSED"] }
    }).select("title doorNumber status departmentId createdAt");

    if (reallocateWork && openComplaints.length > 0) {
        const replacement = await User.findOne({
            _id: { $ne: staff._id },
            role: staff.role,
            departmentId: staff.departmentId,
            isActive: true,
            isAvailable: true
        });

        if (replacement) {
            await transferUnfinishedWork({
                fromStaffId: staff._id,
                toStaffId: replacement._id,
                reason: `Automatic reallocation due to staff deactivation: ${reason}`,
                actor
            });
        }
    }

    await AuditLog.create({
        action: "STAFF_DEACTIVATED",
        performedBy: { id: actor.id, name: actor.name, role: actor.role, email: actor.email },
        target: { id: staff._id, model: "User", identifier: staff.email },
        details: { reason, openJobsCount: openComplaints.length }
    });

    return {
        success: true,
        staffId: staff._id,
        name: staff.name,
        openJobsCount: openComplaints.length,
        openComplaints
    };
}

/**
 * Restores a deactivated staff account.
 */
async function restoreStaffAccount({ staffId, actor }) {
    const staff = await User.findById(staffId);
    if (!staff) throw new Error("Staff member not found");

    staff.isActive = true;
    staff.isAvailable = true;
    staff.availabilityReason = "";
    await staff.save();

    await AuditLog.create({
        action: "STAFF_RESTORED",
        performedBy: { id: actor.id, name: actor.name, role: actor.role, email: actor.email },
        target: { id: staff._id, model: "User", identifier: staff.email }
    });

    return {
        success: true,
        staffId: staff._id,
        name: staff.name,
        email: staff.email,
        isActive: true
    };
}

/**
 * Transfers all open work from one employee to another employee.
 */
async function transferUnfinishedWork({ fromStaffId, toStaffId, reason, actor }) {
    if (!reason || !reason.trim()) {
        throw new Error("A transfer reason must be provided.");
    }

    const fromStaff = await User.findById(fromStaffId);
    const toStaff = await User.findById(toStaffId);

    if (!fromStaff || !toStaff) {
        throw new Error("Source or destination staff member not found.");
    }

    if (!toStaff.isActive) {
        throw new Error("Target staff member is deactivated.");
    }

    const openComplaints = await Complaint.find({
        assignedTo: fromStaff._id,
        status: { $in: ["Pending", "In Progress", "Reopened"] },
        lifecycleState: { $nin: ["RESOLVED", "AWAITING_STUDENT_CONFIRMATION", "CONFIRMED", "CLOSED"] }
    });

    const now = new Date();
    const transferred = [];

    for (const comp of openComplaints) {
        comp.assignedTo = toStaff._id;
        comp.assignedAt = now;
        comp.reassignmentHistory.push({
            previousStaff: fromStaff._id,
            newStaff: toStaff._id,
            reason: `Batch transfer from ${fromStaff.name} to ${toStaff.name}: ${reason}`,
            reassignedBy: actor.id,
            reassignedByRole: actor.role,
            timestamp: now
        });
        comp.statusHistory.push({
            status: comp.status,
            note: `Work transferred from ${fromStaff.name} to ${toStaff.name}. Reason: ${reason}`,
            timestamp: now,
            actor: actor.name,
            actorId: actor.id,
            staffId: toStaff._id
        });
        await comp.save();

        await ComplaintEvent.create({
            complaintId: comp._id,
            eventType: "REASSIGNED",
            actor: { id: actor.id, name: actor.name, role: actor.role },
            previousState: { assignedTo: fromStaff._id, staffName: fromStaff.name },
            newState: { assignedTo: toStaff._id, staffName: toStaff.name },
            note: `Batch transfer: ${reason}`
        });

        transferred.push(comp._id);
    }

    await AuditLog.create({
        action: "WORK_TRANSFERRED",
        performedBy: { id: actor.id, name: actor.name, role: actor.role, email: actor.email },
        target: { id: toStaff._id, model: "User", identifier: toStaff.email },
        details: {
            fromStaff: fromStaff.name,
            toStaff: toStaff.name,
            count: transferred.length,
            reason
        }
    });

    return {
        success: true,
        transferredCount: transferred.length,
        fromStaff: fromStaff.name,
        toStaff: toStaff.name
    };
}

/**
 * Updates an employee's availability.
 * Management-controlled only!
 */
async function updateEmployeeAvailability({ staffId, isAvailable, availabilityReason = "", actor }) {
    const staff = await User.findById(staffId);
    if (!staff) throw new Error("Staff member not found");

    staff.isAvailable = Boolean(isAvailable);
    staff.availabilityReason = availabilityReason.trim();
    await staff.save();

    await AuditLog.create({
        action: "AVAILABILITY_CHANGED",
        performedBy: { id: actor.id, name: actor.name, role: actor.role, email: actor.email },
        target: { id: staff._id, model: "User", identifier: staff.email },
        details: { isAvailable: staff.isAvailable, reason: staff.availabilityReason }
    });

    return {
        success: true,
        staffId: staff._id,
        isAvailable: staff.isAvailable,
        availabilityReason: staff.availabilityReason
    };
}

module.exports = {
    createStaffAccount,
    updateStaffAccount,
    resetStaffPassword,
    deactivateStaffAccount,
    restoreStaffAccount,
    transferUnfinishedWork,
    updateEmployeeAvailability
};
