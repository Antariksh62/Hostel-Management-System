const Complaint = require("../models/Complaint");
const Department = require("../models/Department");
const EscalationEvent = require("../models/EscalationEvent");
const ComplaintEvent = require("../models/ComplaintEvent");
const AuditLog = require("../models/AuditLog");
const { broadcastNotification } = require("./notificationService");

/**
 * Evaluates open complaints against their department's escalation policy.
 */
async function evaluateEscalations() {
    const now = new Date();
    const openComplaints = await Complaint.find({
        status: { $in: ["Pending", "In Progress", "Reopened"] },
        lifecycleState: { $nin: ["RESOLVED", "AWAITING_STUDENT_CONFIRMATION", "CONFIRMED", "CLOSED"] }
    }).populate("departmentId assignedTo");

    const escalatedResults = [];

    for (const comp of openComplaints) {
        const dept = comp.departmentId;
        const policy = dept?.escalationPolicy || {
            ackDeadlineMinutes: 120,
            startDeadlineMinutes: 240,
            resolveDeadlineMinutes: 1440,
            reEscalationIntervalMinutes: 360
        };

        let shouldEscalate = false;
        let triggerType = null;
        let reason = "";

        const assignedTime = comp.assignedAt ? new Date(comp.assignedAt) : new Date(comp.createdAt);
        const ageMinutes = (now - assignedTime) / (1000 * 60);

        // Check 1: Unacknowledged beyond deadline
        if (!comp.acceptedAt && ageMinutes > policy.ackDeadlineMinutes) {
            shouldEscalate = true;
            triggerType = "UNACKNOWLEDGED_DEADLINE";
            reason = `Job unacknowledged for ${Math.round(ageMinutes)} mins (Deadline: ${policy.ackDeadlineMinutes} mins)`;
        }
        // Check 2: Unstarted beyond deadline
        else if (comp.acceptedAt && !comp.workStartedAt) {
            const acceptedMinutes = (now - new Date(comp.acceptedAt)) / (1000 * 60);
            if (acceptedMinutes > policy.startDeadlineMinutes) {
                shouldEscalate = true;
                triggerType = "UNSTARTED_DEADLINE";
                reason = `Work not started after ${Math.round(acceptedMinutes)} mins of acceptance (Deadline: ${policy.startDeadlineMinutes} mins)`;
            }
        }
        // Check 3: In progress beyond resolution deadline
        else if (comp.workStartedAt) {
            const progressMinutes = (now - new Date(comp.workStartedAt)) / (1000 * 60);
            if (progressMinutes > policy.resolveDeadlineMinutes) {
                shouldEscalate = true;
                triggerType = "IN_PROGRESS_OVERDUE";
                reason = `Work in progress for ${Math.round(progressMinutes)} mins without resolution (Deadline: ${policy.resolveDeadlineMinutes} mins)`;
            }
        }
        // Check 4: Repeatedly Reopened
        else if (comp.status === "Reopened") {
            const reopenCount = comp.statusHistory.filter(s => s.status === "Reopened").length;
            if (reopenCount >= 2) {
                shouldEscalate = true;
                triggerType = "REPEATEDLY_REOPENED";
                reason = `Complaint repeatedly reopened ${reopenCount} times by resident`;
            }
        }

        if (shouldEscalate) {
            // Deduplication window check: Has this complaint already escalated within reEscalationIntervalMinutes?
            if (comp.lastEscalatedAt) {
                const sinceLastEscalateMins = (now - new Date(comp.lastEscalatedAt)) / (1000 * 60);
                if (sinceLastEscalateMins < policy.reEscalationIntervalMinutes) {
                    continue; // Skip duplicate notification within the same cycle
                }
            }

            // Increment escalation cycle & persist
            const newLevel = (comp.escalationLevel || 0) + 1;
            comp.escalationLevel = newLevel;
            comp.lastEscalatedAt = now;
            await comp.save();

            // Record EscalationEvent
            const notifiedRoles = ["WARDEN", "HEADWARDEN", "INCHARGE", "MAIN_ADMIN"];
            await EscalationEvent.create({
                complaintId: comp._id,
                departmentId: dept?._id || comp.departmentId,
                triggerType,
                escalationCycle: newLevel,
                notifiedRoles,
                assignedStaffId: comp.assignedTo?._id || null,
                timestamp: now
            });

            // Append to ComplaintEvent
            await ComplaintEvent.create({
                complaintId: comp._id,
                eventType: "ESCALATED",
                actor: { name: "System Escalation Engine", role: "SYSTEM" },
                newState: { escalationLevel: newLevel, triggerType },
                note: `[Cycle ${newLevel}] ${reason}. Management alerted.`
            });

            await AuditLog.create({
                action: "COMPLAINT_ESCALATED",
                performedBy: { id: comp.studentId || comp._id, name: "System Escalation Engine", role: "SYSTEM", email: "system@pict.edu" },
                target: { id: comp._id, model: "Complaint", identifier: comp.title },
                details: { escalationLevel: newLevel, triggerType, reason, outcome: "SUCCESS" }
            }).catch(e => console.error("AuditLog escalation error:", e.message));

            // Scoped notifications: Do NOT send Anti-Ragging escalations to WARDEN or HEADWARDEN!
            const targetRoles = comp.isAntiRagging
                ? ["MAIN_ADMIN", "INCHARGE"]
                : notifiedRoles;

            await broadcastNotification({
                roles: targetRoles,
                type: "COMPLAINT_ESCALATION",
                title: `🚨 Escalation Level ${newLevel}: ${comp.title}`,
                message: `[${dept ? dept.name : 'General'}] ${reason}. Assigned to: ${comp.assignedTo ? comp.assignedTo.name : 'Unassigned'}`,
                link: `/incharge-dashboard?tab=complaints&id=${comp._id}`
            }).catch(() => {});

            escalatedResults.push({
                complaintId: comp._id,
                title: comp.title,
                department: dept ? dept.name : "Unknown",
                escalationLevel: newLevel,
                triggerType,
                reason
            });
        }
    }

    return {
        timestamp: now,
        escalatedCount: escalatedResults.length,
        escalations: escalatedResults
    };
}

module.exports = {
    evaluateEscalations
};

