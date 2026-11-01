const mongoose = require("mongoose");
const Complaint = require("../models/Complaint");
const { User, Staff } = require("../models/User");
const { getFloorFromRoom, getRoomsByFloor } = require("../utils/hostelRooms");

/**
 * staffPerformanceService.js
 * Persisted status-history analytics for Staff Performance and Resolution Effectiveness.
 *
 * Evaluates:
 * - First-attempt resolution success vs failure vs awaiting confirmation
 * - Staff attribution based on immutable statusHistory events and assignedTo tracking
 * - Reopened complaints and repeat visits
 * - Average resolution duration
 * - Strict role-based isolation (ensuring WARDEN never receives Wi-Fi tickets/metrics)
 */

/**
 * Analyzes a single complaint's resolution lifecycle from its status history.
 */
function analyzeComplaintLifecycle(complaint) {
    const history = complaint.statusHistory || [];
    const attempts = [];
    let currentStaffId = complaint.assignedTo ? complaint.assignedTo.toString() : null;
    let currentStaffName = null;

    let resolveAttemptCounter = 0;

    history.forEach((event, idx) => {
        if (event.status === "Assigned") {
            if (event.staffId) currentStaffId = event.staffId.toString();
            const match = (event.note || "").match(/Assigned to (.+)/);
            if (match) currentStaffName = match[1].trim();
        }

        if (event.status === "Resolved") {
            resolveAttemptCounter++;
            const resolverId = event.staffId
                ? event.staffId.toString()
                : (event.actorId ? event.actorId.toString() : currentStaffId);
            const resolverName = event.actor || currentStaffName || null;

            // Check if any status change after this was "Reopened"
            const subsequentEvents = history.slice(idx + 1);
            const wasReopenedLater = subsequentEvents.some(e => e.status === "Reopened");

            attempts.push({
                attemptNumber: resolveAttemptCounter,
                timestamp: event.timestamp,
                note: event.note || "",
                staffId: resolverId,
                staffName: resolverName,
                wasReopenedLater
            });
        }
    });

    const totalAttempts = attempts.length;
    let firstAttemptOutcome = "PENDING"; // PENDING | FIRST_ATTEMPT_SUCCESS | NOT_SOLVED_FIRST_TRY | AWAITING_CONFIRMATION

    const isCurrentlyResolved = complaint.status === "Resolved";
    const hasReopenedEvent = history.some(e => e.status === "Reopened");
    const isCurrentlyReopened = complaint.status === "Reopened" || hasReopenedEvent;

    if (totalAttempts > 0) {
        const firstAttempt = attempts[0];
        
        // Not solved first try if:
        // 1. Complaint was reopened after first resolution
        // 2. Student submitted negative feedback (isSatisfied === false)
        // 3. Follow-up was flagged
        // 4. More than 1 resolution attempt was needed
        if (firstAttempt.wasReopenedLater || complaint.feedback?.isSatisfied === false || complaint.followUpRequired || totalAttempts > 1) {
            firstAttemptOutcome = "NOT_SOLVED_FIRST_TRY";
        } else if (complaint.feedback?.isSatisfied === true || complaint.roomConfirmedWorking === true) {
            // First-attempt success if student or roommate confirmed satisfactory resolution and not reopened
            firstAttemptOutcome = "FIRST_ATTEMPT_SUCCESS";
        } else if (isCurrentlyResolved && complaint.feedback?.isSatisfied === null && !complaint.roomConfirmedWorking) {
            // Awaiting student confirmation: cannot claim success or failure yet
            firstAttemptOutcome = "AWAITING_CONFIRMATION";
        } else {
            firstAttemptOutcome = "AWAITING_CONFIRMATION";
        }
    } else {
        // Zero resolution attempts recorded in status history:
        // If the complaint was marked Resolved in legacy data without history, label UNKNOWN
        if (complaint.status === "Resolved") {
            firstAttemptOutcome = "UNKNOWN";
        } else {
            firstAttemptOutcome = "PENDING";
        }
    }

    // Resolution duration in milliseconds (if resolved)
    let durationMs = null;
    if (complaint.assignedAt && complaint.resolvedAt) {
        const diff = new Date(complaint.resolvedAt).getTime() - new Date(complaint.assignedAt).getTime();
        if (diff > 0) durationMs = diff;
    } else if (complaint.createdAt && complaint.resolvedAt) {
        const diff = new Date(complaint.resolvedAt).getTime() - new Date(complaint.createdAt).getTime();
        if (diff > 0) durationMs = diff;
    }

    // Determine authentic confirmation details (Section C & D)
    const personallyConfirmed = Boolean(complaint.feedback?.submittedAt && complaint.feedback?.isSatisfied !== null);
    const confirmedByRoommate = Boolean(complaint.roommateConfirmation?.confirmedBy);
    const actualConfirmingActor = personallyConfirmed
        ? (complaint.studentId?.fullName || complaint.studentId?.name || "Student")
        : (confirmedByRoommate ? complaint.roommateConfirmation.confirmedBy : null);
    const actualConfirmationTimestamp = personallyConfirmed
        ? complaint.feedback.submittedAt
        : (confirmedByRoommate ? complaint.roommateConfirmation.confirmedAt : null);

    // Identify if there was subsequent contradictory feedback after an initial positive confirmation
    const firstFeedbackIdx = history.findIndex(e => e.status === "Feedback");
    const subsequentReopenEvent = firstFeedbackIdx !== -1
        ? history.slice(firstFeedbackIdx + 1).find(e => e.status === "Reopened")
        : null;

    const issueId = complaint.parentComplaintId
        ? String(complaint.parentComplaintId)
        : String(complaint._id);

    return {
        complaintId: complaint._id,
        issueId,
        parentComplaintId: complaint.parentComplaintId || null,
        associatedComplaints: complaint.associatedComplaints || [],
        roommateConfirmation: complaint.roommateConfirmation || null,
        personallyConfirmed,
        confirmedByRoommate,
        actualConfirmingActor,
        actualConfirmationTimestamp,
        hasContradictoryFeedback: Boolean(subsequentReopenEvent),
        contradictoryEvent: subsequentReopenEvent ? {
            timestamp: subsequentReopenEvent.timestamp,
            actor: subsequentReopenEvent.actor,
            note: subsequentReopenEvent.note
        } : null,
        title: complaint.title,
        description: complaint.description || "",
        category: complaint.category,
        quickCategory: complaint.quickCategory,
        doorNumber: complaint.doorNumber || "Unassigned",
        floor: complaint.doorNumber ? (getFloorFromRoom(complaint.doorNumber) || null) : null,
        status: complaint.status,
        createdAt: complaint.createdAt,
        assignedTo: complaint.assignedTo,
        assignedAt: complaint.assignedAt,
        resolvedAt: complaint.resolvedAt,
        durationMs,
        attempts,
        totalAttempts,
        firstAttemptOutcome,
        isReopened: isCurrentlyReopened,
        reopenCount: history.filter(e => e.status === "Reopened").length,
        feedback: complaint.feedback || { isSatisfied: null },
        roomConfirmedWorking: Boolean(complaint.roomConfirmedWorking),
        followUpRequired: Boolean(complaint.followUpRequired),
        statusHistory: history
    };
}

/**
 * Builds base query with strict category and Wi-Fi isolation rules.
 */
function buildScopedQuery(userRole, filters = {}) {
    const query = {};

    // 1. Critical Wi-Fi isolation for WARDEN: strictly exclude Wi-Fi records
    if (userRole === "WARDEN") {
        query.category = { $nin: ["Internet", "WIFI_NOT_WORKING"] };
        query.quickCategory = { $ne: "WIFI_NOT_WORKING" };
    }

    // 2. Specific Category filter
    if (filters.category && filters.category !== "ALL") {
        // Enforce Wi-Fi block even if requested in filter
        if (userRole === "WARDEN" && (filters.category === "Internet" || filters.category === "WIFI_NOT_WORKING")) {
            query.category = "__DENIED__";
        } else {
            query.category = filters.category;
        }
    }

    // 3. Specific Floor filter (strictly matches authentic room inventory)
    if (filters.floor && filters.floor !== "ALL") {
        const fl = parseInt(filters.floor, 10);
        if ([1, 2, 3, 4, 5].includes(fl)) {
            query.doorNumber = { $in: getRoomsByFloor(fl) };
        }
    }

    // 4. Status filter
    if (filters.status && filters.status !== "ALL") {
        query.status = filters.status;
    }

    // 5. Date Range filter (createdAt)
    if (filters.startDate || filters.endDate) {
        query.createdAt = {};
        if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
        if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
    }

    return query;
}

/**
 * Generates overall summary analytics across all eligible complaints.
 */
async function getOverallPerformanceAnalytics(userRole, filters = {}) {
    const query = buildScopedQuery(userRole, filters);

    const complaints = await Complaint.find(query)
        .populate("assignedTo", "name email role staffRole")
        .populate("studentId", "name fullName email prn")
        .lean();

    const analyzed = complaints.map(analyzeComplaintLifecycle);

    // Apply post-analysis filters (e.g. firstAttemptOutcome, staffId)
    let filtered = analyzed;
    if (filters.staffId && filters.staffId !== "ALL") {
        filtered = filtered.filter(c => {
            const isAssigned = c.assignedTo && c.assignedTo._id.toString() === filters.staffId;
            const hadAttempt = c.attempts.some(a => a.staffId === filters.staffId);
            return isAssigned || hadAttempt;
        });
    }

    if (filters.outcome && filters.outcome !== "ALL") {
        filtered = filtered.filter(c => c.firstAttemptOutcome === filters.outcome);
    }

    // Aggregate summary metrics
    const totalHandled = filtered.length;
    const resolvedComplaints = filtered.filter(c => c.status === "Resolved");
    const markedResolvedCount = resolvedComplaints.length;
    const firstAttemptSuccessCount = filtered.filter(c => c.firstAttemptOutcome === "FIRST_ATTEMPT_SUCCESS").length;
    const notSolvedFirstTryCount = filtered.filter(c => c.firstAttemptOutcome === "NOT_SOLVED_FIRST_TRY").length;
    const awaitingConfirmationCount = filtered.filter(c => c.firstAttemptOutcome === "AWAITING_CONFIRMATION").length;
    const reopenedComplaintsCount = filtered.filter(c => c.isReopened).length;
    const pendingCount = filtered.filter(c => c.status === "Pending" || c.status === "In Progress").length;
    const unknownLegacyCount = filtered.filter(c => c.firstAttemptOutcome === "UNKNOWN").length;

    // Room-level issue grouping (Section C & E)
    const issueMap = new Map();
    filtered.forEach(c => {
        const iId = c.issueId || (c.parentComplaintId ? String(c.parentComplaintId) : String(c.complaintId));
        if (!issueMap.has(iId)) {
            issueMap.set(iId, []);
        }
        issueMap.get(iId).push(c);
    });

    const uniqueRoomIssuesHandled = issueMap.size;
    const subsequentResolutionAttempts = filtered.reduce((sum, c) => sum + Math.max(0, (c.totalAttempts || 0) - 1), 0);
    const complaintsWithSubsequentAttempts = filtered.filter(c => (c.totalAttempts || 0) > 1).length;
    const reopenedIssuesCount = Array.from(issueMap.values()).filter(comps => comps.some(c => c.isReopened)).length;

    // Issue-level resolution metrics (counted once per room-level issue)
    const roomIssuesResolvedCount = Array.from(issueMap.values()).filter(comps =>
        comps.some(c => c.status === "Resolved") && !comps.some(c => c.status === "Pending" || c.status === "In Progress" || c.status === "Reopened")
    ).length;

    const roomIssuesFirstAttemptSuccessCount = Array.from(issueMap.values()).filter(comps =>
        comps.every(c => c.firstAttemptOutcome === "FIRST_ATTEMPT_SUCCESS")
    ).length;

    const roomIssuesNotSolvedFirstTryCount = Array.from(issueMap.values()).filter(comps =>
        comps.some(c => c.firstAttemptOutcome === "NOT_SOLVED_FIRST_TRY")
    ).length;

    const roomIssuesAwaitingConfirmationCount = Array.from(issueMap.values()).filter(comps =>
        comps.some(c => c.firstAttemptOutcome === "AWAITING_CONFIRMATION")
    ).length;

    // Count of actual distinct student feedback submissions (not counting suppressed roommate copies)
    const actualStudentResponsesCount = filtered.filter(c => c.personallyConfirmed).length;

    // Calculate average resolution duration (in hours)
    const durations = filtered.map(c => c.durationMs).filter(d => typeof d === "number" && d > 0);
    const avgDurationHours = durations.length > 0
        ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length / (1000 * 60 * 60)) * 10) / 10
        : 0;

    // Category breakdown
    const categoryBreakdown = {};
    // Floor breakdown
    const floorBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    filtered.forEach(c => {
        const cat = c.category || "Other";
        categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1;
        if (c.floor && floorBreakdown[c.floor] !== undefined) {
            floorBreakdown[c.floor]++;
        }
    });

    // Decided complaints denominator (excluding UNKNOWN and AWAITING_CONFIRMATION per Section A & B)
    const decidedComplaintsCount = firstAttemptSuccessCount + notSolvedFirstTryCount;
    const firstAttemptSuccessRate = decidedComplaintsCount > 0
        ? Math.round((firstAttemptSuccessCount / decidedComplaintsCount) * 100)
        : 0;

    return {
        overview: {
            totalHandled,
            uniqueIndividualComplaintsHandled: totalHandled,
            uniqueRoomIssuesHandled,
            markedResolvedCount,
            firstAttemptSuccessCount,
            notSolvedFirstTryCount,
            firstAttemptUnsuccessfulCount: notSolvedFirstTryCount,
            subsequentResolutionAttempts,
            complaintsWithSubsequentAttempts,
            reopenedComplaintsCount,
            reopenedIssuesCount,
            awaitingConfirmationCount,
            unknownLegacyCount,
            unattributedCount: unknownLegacyCount,
            actualStudentResponsesCount,
            roomIssuesResolvedCount,
            roomIssuesFirstAttemptSuccessCount,
            roomIssuesNotSolvedFirstTryCount,
            roomIssuesAwaitingConfirmationCount,
            pendingCount,
            avgDurationHours,
            firstAttemptSuccessRate,
            overallFirstAttemptRate: totalHandled > 0 ? Math.round((firstAttemptSuccessCount / totalHandled) * 100) : 0
        },
        categoryBreakdown,
        floorBreakdown
    };
}

/**
 * Generates staff-by-staff performance breakdown table with attribution.
 */
async function getStaffPerformanceTable(userRole, filters = {}) {
    const query = buildScopedQuery(userRole, filters);

    // Fetch relevant staff members
    const staffQuery = { role: "STAFF" };
    // If user is WARDEN, exclude Wi-Fi in-charge or specialist staff accounts
    if (userRole === "WARDEN") {
        staffQuery.staffRole = { $ne: "Wi-Fi Specialist" };
    }

    const staffList = await User.find(staffQuery)
        .select("name email role staffRole officeLocation")
        .lean();

    const complaints = await Complaint.find(query)
        .populate("assignedTo", "name email role staffRole")
        .populate("studentId", "name fullName email prn")
        .lean();

    const analyzed = complaints.map(analyzeComplaintLifecycle);

    // Build map for each staff member
    const staffMetricsMap = new Map();

    staffList.forEach(s => {
        staffMetricsMap.set(s._id.toString(), {
            staffId: s._id.toString(),
            name: s.name || s.email,
            email: s.email,
            staffRole: s.staffRole || "General Maintenance",
            assignedCount: 0,
            resolvedCount: 0,
            firstAttemptSuccessCount: 0,
            notSolvedFirstTryCount: 0,
            reopenedCount: 0,
            pendingCount: 0,
            awaitingConfirmationCount: 0,
            durationSamples: []
        });
    });

    // Unattributed bucket for legacy or unassigned records
    const unattributed = {
        staffId: "UNATTRIBUTED",
        name: "Unattributed / Historical",
        email: "system@pict.edu",
        staffRole: "Legacy / Unassigned",
        assignedCount: 0,
        resolvedCount: 0,
        firstAttemptSuccessCount: 0,
        notSolvedFirstTryCount: 0,
        reopenedCount: 0,
        pendingCount: 0,
        awaitingConfirmationCount: 0,
        durationSamples: []
    };

    analyzed.forEach(c => {
        // 1. Identify all staff members associated with this complaint
        const involvedStaffIds = new Set();
        if (c.assignedTo && c.assignedTo._id) {
            involvedStaffIds.add(c.assignedTo._id.toString());
        }
        (c.attempts || []).forEach(a => {
            if (a.staffId) involvedStaffIds.add(a.staffId.toString());
        });
        (c.statusHistory || []).forEach(e => {
            if (e.staffId) involvedStaffIds.add(e.staffId.toString());
        });

        // 2. Track assignedCount and current pending workload
        if (involvedStaffIds.size === 0) {
            unattributed.assignedCount++;
            if (c.status === "Pending" || c.status === "In Progress" || c.status === "Reopened") {
                unattributed.pendingCount++;
            }
        } else {
            involvedStaffIds.forEach(sId => {
                if (staffMetricsMap.has(sId)) {
                    staffMetricsMap.get(sId).assignedCount++;
                }
            });
            const currentAssigneeId = c.assignedTo ? c.assignedTo._id.toString() : null;
            if (currentAssigneeId && staffMetricsMap.has(currentAssigneeId)) {
                if (c.status === "Pending" || c.status === "In Progress" || c.status === "Reopened") {
                    staffMetricsMap.get(currentAssigneeId).pendingCount++;
                }
            }
        }

        // 3. First Attempt Outcome Attribution
        // The staff member who performed Attempt 1 is evaluated for first attempt outcome
        if (c.attempts.length > 0) {
            const firstAttempt = c.attempts[0];
            const attempt1StaffId = firstAttempt.staffId;
            const attempt1Metrics = (attempt1StaffId && staffMetricsMap.has(attempt1StaffId))
                ? staffMetricsMap.get(attempt1StaffId)
                : (c.assignedTo && staffMetricsMap.has(c.assignedTo._id.toString()) ? staffMetricsMap.get(c.assignedTo._id.toString()) : unattributed);

            if (c.firstAttemptOutcome === "FIRST_ATTEMPT_SUCCESS") {
                attempt1Metrics.firstAttemptSuccessCount++;
            } else if (c.firstAttemptOutcome === "NOT_SOLVED_FIRST_TRY") {
                attempt1Metrics.notSolvedFirstTryCount++;
            } else if (c.firstAttemptOutcome === "AWAITING_CONFIRMATION") {
                attempt1Metrics.awaitingConfirmationCount++;
            }

            // Track reopen counts for any attempts that were reopened later
            c.attempts.forEach(att => {
                if (att.wasReopenedLater) {
                    const attMetrics = (att.staffId && staffMetricsMap.has(att.staffId))
                        ? staffMetricsMap.get(att.staffId)
                        : unattributed;
                    attMetrics.reopenedCount++;
                }
            });

            // 4. Resolution Credit & Duration Attribution
            // Credited to the staff member who performed the final resolution
            if (c.status === "Resolved") {
                const finalAttempt = c.attempts[c.attempts.length - 1];
                const finalResolverId = finalAttempt ? finalAttempt.staffId : null;
                const resolverMetrics = (finalResolverId && staffMetricsMap.has(finalResolverId))
                    ? staffMetricsMap.get(finalResolverId)
                    : (c.assignedTo && staffMetricsMap.has(c.assignedTo._id.toString()) ? staffMetricsMap.get(c.assignedTo._id.toString()) : unattributed);

                resolverMetrics.resolvedCount++;
                if (c.durationMs) {
                    resolverMetrics.durationSamples.push(c.durationMs);
                }
            }
        } else if (c.status === "Resolved") {
            // Legacy resolved complaint with 0 status history events
            unattributed.resolvedCount++;
            if (c.durationMs) {
                unattributed.durationSamples.push(c.durationMs);
            }
        }
    });

    const resultRows = Array.from(staffMetricsMap.values()).map(row => {
        const avgHours = row.durationSamples.length > 0
            ? Math.round((row.durationSamples.reduce((a, b) => a + b, 0) / row.durationSamples.length / (1000 * 60 * 60)) * 10) / 10
            : 0;

        const totalDecided = row.firstAttemptSuccessCount + row.notSolvedFirstTryCount;
        const firstAttemptSuccessRate = totalDecided > 0
            ? Math.round((row.firstAttemptSuccessCount / totalDecided) * 100)
            : 0;

        return {
            staffId: row.staffId,
            name: row.name,
            email: row.email,
            staffRole: row.staffRole,
            assignedCount: row.assignedCount,
            resolvedCount: row.resolvedCount,
            firstAttemptSuccessCount: row.firstAttemptSuccessCount,
            notSolvedFirstTryCount: row.notSolvedFirstTryCount,
            reopenedCount: row.reopenedCount,
            pendingCount: row.pendingCount,
            awaitingConfirmationCount: row.awaitingConfirmationCount,
            avgResolutionDurationHours: avgHours,
            firstAttemptSuccessRate
        };
    });

    // If unattributed has records, append it transparently at the end
    if (unattributed.assignedCount > 0 || unattributed.resolvedCount > 0) {
        const avgHours = unattributed.durationSamples.length > 0
            ? Math.round((unattributed.durationSamples.reduce((a, b) => a + b, 0) / unattributed.durationSamples.length / (1000 * 60 * 60)) * 10) / 10
            : 0;
        resultRows.push({
            staffId: "UNATTRIBUTED",
            name: unattributed.name,
            email: unattributed.email,
            staffRole: unattributed.staffRole,
            assignedCount: unattributed.assignedCount,
            resolvedCount: unattributed.resolvedCount,
            firstAttemptSuccessCount: unattributed.firstAttemptSuccessCount,
            notSolvedFirstTryCount: unattributed.notSolvedFirstTryCount,
            reopenedCount: unattributed.reopenedCount,
            pendingCount: unattributed.pendingCount,
            awaitingConfirmationCount: unattributed.awaitingConfirmationCount,
            avgResolutionDurationHours: avgHours,
            firstAttemptSuccessRate: 0
        });
    }

    return resultRows;
}

/**
 * Returns drill-down complaint workload and complete resolution history for a specific staff member.
 */
async function getStaffComplaintDrilldown(userRole, staffId, filters = {}) {
    const query = buildScopedQuery(userRole, filters);

    if (staffId !== "UNATTRIBUTED") {
        query.$or = [
            { assignedTo: staffId },
            { "statusHistory.staffId": staffId },
            { "statusHistory.actorId": staffId }
        ];
    }

    const complaints = await Complaint.find(query)
        .populate("assignedTo", "name email role staffRole")
        .populate("studentId", "name fullName email prn rollNumber branch year doorNumber")
        .sort({ updatedAt: -1 })
        .lean();

    const analyzed = complaints.map(analyzeComplaintLifecycle);

    return analyzed;
}

module.exports = {
    analyzeComplaintLifecycle,
    buildScopedQuery,
    getOverallPerformanceAnalytics,
    getStaffPerformanceTable,
    getStaffComplaintDrilldown
};

