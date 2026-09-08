const Complaint    = require("../models/Complaint");
const { User }     = require("../models/User");
const Room         = require("../models/Room");
const Announcement = require("../models/Announcement");
const mongoose     = require("mongoose");


// ─── Helper: ms → human readable ─────────────────────────────────────────────
const msToHours = (ms) => ms ? Math.round((ms / (1000 * 60 * 60)) * 10) / 10 : null;
const msToReadable = (ms) => {
    if (!ms) return "N/A";
    const hours = ms / (1000 * 60 * 60);
    if (hours < 24) return `${Math.round(hours)}h`;
    return `${Math.round(hours / 24)}d`;
};

// Returns the most frequently occurring value in an array
const getMostFrequent = (arr) => {
    if (!arr || arr.length === 0) return null;
    const freq = {};
    let max = 0, result = arr[0];
    for (const v of arr) {
        freq[v] = (freq[v] || 0) + 1;
        if (freq[v] > max) { max = freq[v]; result = v; }
    }
    return result;
};

// =============================================================================
// GET /api/incharge/dashboard/overview
// Executive summary cards
// =============================================================================
exports.getOverview = async (req, res) => {
    try {
        const now   = new Date();
        const week  = new Date(now); week.setDate(now.getDate() - 7);
        const month = new Date(now); month.setDate(now.getDate() - 30);

        const [
            totalStudents,
            totalStaff,
            totalWardens,
            totalHeadWardens,
            rooms,
            statusCounts,
            resolvedComplaints,
            weekComplaints,
            monthComplaints,
            highPriorityData,
            repeatComplaints
        ] = await Promise.all([
            User.countDocuments({ role: "STUDENT" }),
            User.countDocuments({ role: "STAFF" }),
            User.countDocuments({ role: "WARDEN" }),
            User.countDocuments({ role: "HEADWARDEN" }),
            Room.find().select("roomNumber capacity occupants"),
            Complaint.aggregate([
                { $group: { _id: "$status", count: { $sum: 1 } } }
            ]),
            Complaint.aggregate([
                { $match: { status: "Resolved", resolvedAt: { $exists: true, $ne: null } } },
                { $project: { resolutionMs: { $subtract: ["$resolvedAt", "$createdAt"] } } },
                { $group: { _id: null, avgMs: { $avg: "$resolutionMs" }, minMs: { $min: "$resolutionMs" }, maxMs: { $max: "$resolutionMs" } } }
            ]),
            Complaint.countDocuments({ createdAt: { $gte: week } }),
            Complaint.countDocuments({ createdAt: { $gte: month } }),
            // Complaints reopened or with unsatisfied feedback as high-priority proxy
            Complaint.countDocuments({ $or: [{ status: "Reopened" }, { "feedback.isSatisfied": false }] }),
            // Rooms with more than 1 complaint in same category
            Complaint.aggregate([
                { $group: { _id: { door: "$doorNumber", cat: "$category" }, count: { $sum: 1 } } },
                { $match: { count: { $gt: 1 } } },
                { $count: "total" }
            ])
        ]);

        const totalRooms    = rooms.length;
        const occupiedRooms = rooms.filter(r => r.occupants && r.occupants.length > 0).length;
        const vacantRooms   = totalRooms - occupiedRooms;

        const statusMap = {};
        statusCounts.forEach(({ _id, count }) => { statusMap[_id] = count; });
        const totalComplaints  = Object.values(statusMap).reduce((a, b) => a + b, 0);
        const pendingCount     = (statusMap["Pending"] || 0) + (statusMap["Reopened"] || 0);
        const resolvedCount    = statusMap["Resolved"] || 0;
        const inProgressCount  = statusMap["In Progress"] || 0;
        const resolutionRate   = totalComplaints > 0 ? Math.round((resolvedCount / totalComplaints) * 100) : 0;

        const avgResHours = resolvedComplaints[0] ? msToHours(resolvedComplaints[0].avgMs) : null;
        const fastestRes  = resolvedComplaints[0] ? msToReadable(resolvedComplaints[0].minMs) : "N/A";
        const slowestRes  = resolvedComplaints[0] ? msToReadable(resolvedComplaints[0].maxMs) : "N/A";

        res.json({
            students:           totalStudents,
            staff:              totalStaff,
            wardens:            totalWardens,
            headWardens:        totalHeadWardens,
            totalRooms,
            occupiedRooms,
            vacantRooms,
            totalComplaints,
            activeComplaints:   pendingCount + inProgressCount,
            pendingComplaints:  pendingCount,
            inProgressComplaints: inProgressCount,
            resolvedComplaints: resolvedCount,
            resolutionRate,
            avgResolutionHours: avgResHours,
            fastestResolution:  fastestRes,
            slowestResolution:  slowestRes,
            complaintsThisWeek:  weekComplaints,
            complaintsThisMonth: monthComplaints,
            highPriorityIssues:  highPriorityData,
            repeatComplaints:    repeatComplaints[0]?.total || 0
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// =============================================================================
// GET /api/incharge/dashboard/complaint-analytics
// Complaint category breakdown + trends
// =============================================================================
exports.getComplaintAnalytics = async (req, res) => {
    try {
        const { days = 30, from, to } = req.query;
        // If explicit date range provided, use it; otherwise fall back to 'days'
        let since, until;
        if (from) {
            since = new Date(from);
            until = to ? new Date(new Date(to).setHours(23,59,59,999)) : new Date();
        } else {
            const daysNum = Math.min(parseInt(days) || 30, 365);
            since = new Date(); since.setDate(since.getDate() - daysNum);
            until = new Date();
        }
        const daysNum = Math.round((until - since) / (1000*60*60*24)) || 30;

        const [byCategory, trend, byStatus, funnel] = await Promise.all([
            // By category with percentage (all-time or filtered)
            Complaint.aggregate([
                { $match: { createdAt: { $gte: since, $lte: until } } },
                { $group: { _id: "$category", count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]),

            // Daily trend
            Complaint.aggregate([
                { $match: { createdAt: { $gte: since, $lte: until } } },
                {
                    $group: {
                        _id:   { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ]),

            // Status breakdown
            Complaint.aggregate([
                { $match: { createdAt: { $gte: since, $lte: until } } },
                { $group: { _id: "$status", count: { $sum: 1 } } }
            ]),

            // Resolution funnel
            Complaint.aggregate([
                { $match: { createdAt: { $gte: since, $lte: until } } },
                {
                    $group: {
                        _id: null,
                        created:    { $sum: 1 },
                        assigned:   { $sum: { $cond: [{ $ne: ["$assignedTo", null] }, 1, 0] } },
                        inProgress: { $sum: { $cond: [{ $in: ["$status", ["In Progress", "Resolved"]] }, 1, 0] } },
                        resolved:   { $sum: { $cond: [{ $eq: ["$status", "Resolved"] }, 1, 0] } }
                    }
                }
            ])
        ]);

        const total = byCategory.reduce((a, b) => a + b.count, 0);
        const categoriesWithPct = byCategory.map(c => ({
            name:    c._id,
            count:   c.count,
            percent: total > 0 ? Math.round((c.count / total) * 100) : 0
        }));

        // Fill days
        const trendMap = {};
        trend.forEach(({ _id, count }) => { trendMap[_id] = count; });
        const filledTrend = [];
        for (let i = daysNum - 1; i >= 0; i--) {
            const d = new Date(until); d.setDate(d.getDate() - i);
            const key = d.toISOString().split("T")[0];
            filledTrend.push({ date: key, count: trendMap[key] || 0 });
        }

        // Weekly aggregation
        const weeklyMap = {};
        filledTrend.forEach(({ date, count }) => {
            const d    = new Date(date);
            const wStart = new Date(d);
            wStart.setDate(d.getDate() - d.getDay());
            const wKey = wStart.toISOString().split("T")[0];
            weeklyMap[wKey] = (weeklyMap[wKey] || 0) + count;
        });
        const weeklyTrend = Object.entries(weeklyMap).map(([week, count]) => ({ week, count }));

        res.json({
            byCategory: categoriesWithPct,
            dailyTrend: filledTrend,
            weeklyTrend,
            byStatus,
            funnel: funnel[0] || { created: 0, assigned: 0, inProgress: 0, resolved: 0 }
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};


// =============================================================================
// GET /api/incharge/dashboard/staff-performance
// Per-staff complaint resolution metrics
// =============================================================================
exports.getStaffPerformance = async (req, res) => {
    try {
        const staffList = await User.find({ role: "STAFF" }).select("name email");

        const performanceData = await Promise.all(
            staffList.map(async (staff) => {
                const [assigned, resolved, pending, avgRes] = await Promise.all([
                    Complaint.countDocuments({ assignedTo: staff._id }),
                    Complaint.countDocuments({ assignedTo: staff._id, status: "Resolved" }),
                    Complaint.countDocuments({ assignedTo: staff._id, status: { $in: ["In Progress", "Pending", "Reopened"] } }),
                    Complaint.aggregate([
                        { $match: { assignedTo: staff._id, status: "Resolved", resolvedAt: { $exists: true, $ne: null } } },
                        { $project: { resolutionMs: { $subtract: ["$resolvedAt", "$createdAt"] } } },
                        { $group: { _id: null, avgMs: { $avg: "$resolutionMs" } } }
                    ])
                ]);

                const resolutionRate = assigned > 0 ? Math.round((resolved / assigned) * 100) : 0;
                const avgResHours    = avgRes[0] ? msToHours(avgRes[0].avgMs) : null;

                return {
                    id:             staff._id,
                    name:           staff.name,
                    email:          staff.email,
                    assigned,
                    resolved,
                    pending,
                    resolutionRate,
                    avgResolutionHours: avgResHours,
                    efficiencyScore: Math.round((resolutionRate * 0.7) + (avgResHours ? Math.max(0, 30 - (avgResHours / 24)) : 0))
                };
            })
        );

        // Sort by efficiency score desc
        performanceData.sort((a, b) => b.efficiencyScore - a.efficiencyScore);

        res.json(performanceData);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// =============================================================================
// GET /api/incharge/dashboard/warden-performance
// Per-warden assignment speed metrics
// =============================================================================
exports.getWardenPerformance = async (req, res) => {
    try {
        const wardens = await User.find({ role: { $in: ["WARDEN", "HEADWARDEN"] } }).select("name email role createdAt");

        // Compute system-wide metrics once (not per-loop to avoid N redundant DB calls)
        const [totalSystem, resolvedSystem, pendingSystem, avgAssignTime, escalated] = await Promise.all([
            Complaint.countDocuments({}),
            Complaint.countDocuments({ status: "Resolved" }),
            Complaint.countDocuments({ status: { $in: ["Pending", "In Progress"] } }),
            Complaint.aggregate([
                { $match: { assignedAt: { $exists: true, $ne: null } } },
                {
                    $project: {
                        assignMs: {
                            $cond: [
                                { $gt: ["$assignedAt", "$createdAt"] },
                                { $subtract: ["$assignedAt", "$createdAt"] },
                                0
                            ]
                        }
                    }
                },
                { $group: { _id: null, avgMs: { $avg: "$assignMs" } } }
            ]),
            Complaint.countDocuments({ status: "Reopened" })
        ]);

        const resolutionSuccessRate = totalSystem > 0 ? Math.round((resolvedSystem / totalSystem) * 100) : 0;
        const avgAssignHrs = avgAssignTime[0] ? msToHours(avgAssignTime[0].avgMs) : null;

        // Per-warden: count complaints raised after they joined (their active tenure)
        const results = await Promise.all(
            wardens.map(async (w) => {
                const wardenJoinDate = w.createdAt || new Date(0);
                const [assigned, resolvedInTenure] = await Promise.all([
                    Complaint.countDocuments({ createdAt: { $gte: wardenJoinDate }, assignedTo: { $exists: true, $ne: null } }),
                    Complaint.countDocuments({ createdAt: { $gte: wardenJoinDate }, status: "Resolved" })
                ]);
                return {
                    id:                    w._id,
                    name:                  w.name,
                    role:                  w.role,
                    complaintsAssigned:    assigned,
                    resolvedInTenure,
                    pendingSystem,
                    escalatedComplaints:   escalated,
                    avgAssignmentHours:    avgAssignHrs,
                    resolutionSuccessRate
                };
            })
        );

        res.json(results);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// =============================================================================
// GET /api/incharge/dashboard/room-analytics
// Room occupancy & complaint hotspots
// =============================================================================
exports.getRoomAnalytics = async (req, res) => {
    try {
        const [rooms, complaintsByRoom, repeatRooms] = await Promise.all([
            Room.find().select("roomNumber capacity occupants"),
            Complaint.aggregate([
                { $group: { _id: "$doorNumber", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 20 }
            ]),
            Complaint.aggregate([
                { $group: { _id: { door: "$doorNumber", cat: "$category" }, count: { $sum: 1 } } },
                { $match: { count: { $gt: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 }
            ])
        ]);

        const totalRooms    = rooms.length;
        const occupiedRooms = rooms.filter(r => r.occupants && r.occupants.length > 0).length;
        const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

        const roomComplaintMap = {};
        complaintsByRoom.forEach(({ _id, count }) => { roomComplaintMap[_id] = count; });

        const roomDetails = rooms.map(r => ({
            roomNumber:      r.roomNumber,
            capacity:        r.capacity,
            occupants:       r.occupants?.length || 0,
            utilization:     r.capacity > 0 ? Math.round(((r.occupants?.length || 0) / r.capacity) * 100) : 0,
            complaintCount:  roomComplaintMap[r.roomNumber] || 0
        })).sort((a, b) => b.complaintCount - a.complaintCount);

        res.json({
            totalRooms,
            occupiedRooms,
            vacantRooms: totalRooms - occupiedRooms,
            occupancyRate,
            topComplaintRooms: complaintsByRoom,
            repeatIssueRooms: repeatRooms.map(r => ({
                room:     r._id.door,
                category: r._id.cat,
                count:    r.count
            })),
            roomDetails
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// =============================================================================
// GET /api/incharge/dashboard/student-analytics
// Student distribution by year/branch
// =============================================================================
exports.getStudentAnalytics = async (req, res) => {
    try {
        const [byYear, byBranch, total] = await Promise.all([
            User.aggregate([
                { $match: { role: "STUDENT" } },
                { $group: { _id: "$year", count: { $sum: 1 } } },
                { $sort: { _id: 1 } }
            ]),
            User.aggregate([
                { $match: { role: "STUDENT" } },
                { $group: { _id: "$branch", count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]),
            User.countDocuments({ role: "STUDENT" })
        ]);

        res.json({ total, byYear, byBranch });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// =============================================================================
// GET /api/incharge/dashboard/repeat-analysis
// Recurring complaints detection
// =============================================================================
exports.getRepeatAnalysis = async (req, res) => {
    try {
        const [byRoomCategory, byCategory, recentRepeats] = await Promise.all([
            Complaint.aggregate([
                { $group: { _id: { door: "$doorNumber", cat: "$category" }, count: { $sum: 1 } } },
                { $match: { count: { $gt: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 15 }
            ]),
            Complaint.aggregate([
                { $group: { _id: "$category", count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]),
            Complaint.aggregate([
                { $match: { createdAt: { $gte: (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d; })() } } },
                { $group: { _id: { door: "$doorNumber", cat: "$category" }, count: { $sum: 1 } } },
                { $match: { count: { $gt: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 }
            ])
        ]);

        const suggestions = byRoomCategory.map(r => ({
            room:       r._id.door,
            category:   r._id.cat,
            count:      r.count,
            suggestion: getSuggestion(r._id.cat)
        }));

        res.json({ byRoomCategory: suggestions, byCategory, recentRepeats });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

function getSuggestion(category) {
    const map = {
        "Electrical": "Schedule full electrical audit for this room/block",
        "Plumbing":   "Inspect pipes and fittings — recurring leak possible",
        "Furniture":  "Replace or repair furniture — structural issue suspected",
        "Cleanliness":"Review cleaning schedule and assign dedicated staff",
        "Internet":   "Check access point coverage and cable routing",
        "Other":      "Conduct room inspection to identify root cause"
    };
    return map[category] || "Escalate for physical inspection";
}

// =============================================================================
// GET /api/incharge/dashboard/kpis
// Operational KPI scores
// =============================================================================
exports.getKPIs = async (req, res) => {
    try {
        const [total, resolved, avgRes, avgAssign, unresolved, satisfaction] = await Promise.all([
            Complaint.countDocuments(),
            Complaint.countDocuments({ status: "Resolved" }),
            Complaint.aggregate([
                { $match: { status: "Resolved", resolvedAt: { $exists: true, $ne: null } } },
                { $project: { resMs: { $subtract: ["$resolvedAt", "$createdAt"] } } },
                { $group: { _id: null, avg: { $avg: "$resMs" } } }
            ]),
            Complaint.aggregate([
                { $match: { assignedAt: { $exists: true, $ne: null } } },
                {
                    $project: {
                        assignMs: {
                            $cond: [
                                { $gt: ["$assignedAt", "$createdAt"] },
                                { $subtract: ["$assignedAt", "$createdAt"] },
                                0
                            ]
                        }
                    }
                },
                { $group: { _id: null, avg: { $avg: "$assignMs" } } }
            ]),
            Complaint.countDocuments({ status: { $in: ["Pending", "Reopened"] } }),
            Complaint.aggregate([
                {
                    $match: {
                        "feedback.isSatisfied": { $in: [true, false] }
                    }
                },
                { $group: { _id: "$feedback.isSatisfied", count: { $sum: 1 } } }
            ])
        ]);

        const resolutionRate    = total > 0 ? Math.round((resolved / total) * 100) : 0;
        const avgResolutionHrs  = avgRes[0]    ? msToHours(avgRes[0].avg)    : null;
        const avgAssignmentHrs  = avgAssign[0] ? msToHours(avgAssign[0].avg) : null;

        const satisfiedCount    = satisfaction.find(s => s._id === true)?.count  || 0;
        const unsatisfiedCount  = satisfaction.find(s => s._id === false)?.count || 0;
        const totalFeedback     = satisfiedCount + unsatisfiedCount;
        const satisfactionScore = totalFeedback > 0 ? Math.round((satisfiedCount / totalFeedback) * 100) : null;

        // Efficiency score: resolution rate weighted with speed
        const speedScore       = avgResolutionHrs ? Math.max(0, 100 - Math.round(avgResolutionHrs / 24 * 5)) : 50;
        const efficiencyScore  = Math.round(resolutionRate * 0.6 + speedScore * 0.4);

        // Room health: inverse of complaint density
        const totalRooms   = await Room.countDocuments();
        const roomHealth   = totalRooms > 0 ? Math.max(0, Math.round(100 - (total / totalRooms) * 10)) : 50;

        res.json({
            resolutionRate,
            avgResolutionHours: avgResolutionHrs,
            avgAssignmentHours: avgAssignmentHrs,
            efficiencyScore,
            satisfactionScore,
            roomHealthScore:    Math.min(100, roomHealth),
            unresolvedCount:    unresolved
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// =============================================================================
// GET /api/incharge/dashboard/predictive
// Trend-based predictive insights
// =============================================================================
exports.getPredictiveInsights = async (req, res) => {
    try {
        const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const sixtyDaysAgo  = new Date(); sixtyDaysAgo.setDate(sixtyDaysAgo.getDate()  - 60);

        const [recent, older] = await Promise.all([
            Complaint.aggregate([
                { $match: { createdAt: { $gte: thirtyDaysAgo } } },
                { $group: { _id: "$category", count: { $sum: 1 } } }
            ]),
            Complaint.aggregate([
                { $match: { createdAt: { $gte: sixtyDaysAgo, $lte: thirtyDaysAgo } } },
                { $group: { _id: "$category", count: { $sum: 1 } } }
            ])
        ]);

        const recentMap = {};
        recent.forEach(({ _id, count }) => { recentMap[_id] = count; });
        const olderMap  = {};
        older.forEach(({ _id, count }) => { olderMap[_id] = count; });

        const categories = [...new Set([...Object.keys(recentMap), ...Object.keys(olderMap)])];
        const trends = categories.map(cat => {
            const r = recentMap[cat] || 0;
            const o = olderMap[cat]  || 0;
            const change = o > 0 ? Math.round(((r - o) / o) * 100) : (r > 0 ? 100 : 0);
            return { category: cat, recentCount: r, olderCount: o, changePercent: change };
        }).sort((a, b) => b.changePercent - a.changePercent);

        const rising = trends.filter(t => t.changePercent > 10).slice(0, 5);
        const falling = trends.filter(t => t.changePercent < -10).slice(0, 3);

        const recommendations = rising.map(t => ({
            category:       t.category,
            insight:        `${t.category} complaints increased by ${t.changePercent}% this month`,
            action:         getRecommendation(t.category),
            urgency:        t.changePercent > 50 ? "HIGH" : "MEDIUM"
        }));

        res.json({ trends, rising, falling, recommendations });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

function getRecommendation(category) {
    const map = {
        "Electrical": "Conduct block-wide electrical safety inspection immediately",
        "Plumbing":   "Engage plumbing contractor for comprehensive pipe audit",
        "Furniture":  "Budget for furniture procurement in next quarter",
        "Cleanliness":"Increase cleaning frequency and add supervisory checks",
        "Internet":   "Upgrade AP infrastructure and increase bandwidth allocation",
        "Other":      "Schedule monthly hostel condition survey"
    };
    return map[category] || "Review and increase staffing for this area";
}

// =============================================================================
// GET /api/incharge/dashboard/maintenance-insights
// Most frequent maintenance categories
// =============================================================================
exports.getMaintenanceInsights = async (req, res) => {
    try {
        const [byCategory, pendingByCategory, avgResByCategory] = await Promise.all([
            Complaint.aggregate([
                { $group: { _id: "$category", total: { $sum: 1 } } },
                { $sort: { total: -1 } }
            ]),
            Complaint.aggregate([
                { $match: { status: { $in: ["Pending", "In Progress", "Reopened"] } } },
                { $group: { _id: "$category", pending: { $sum: 1 } } }
            ]),
            Complaint.aggregate([
                { $match: { status: "Resolved", resolvedAt: { $exists: true, $ne: null } } },
                { $project: { category: 1, resMs: { $subtract: ["$resolvedAt", "$createdAt"] } } },
                { $group: { _id: "$category", avgMs: { $avg: "$resMs" } } }
            ])
        ]);

        const pendingMap  = {};
        pendingByCategory.forEach(({ _id, pending }) => { pendingMap[_id] = pending; });
        const avgResMap   = {};
        avgResByCategory.forEach(({ _id, avgMs }) => { avgResMap[_id] = msToHours(avgMs); });

        const insights = byCategory.map(c => ({
            category:          c._id,
            totalComplaints:   c.total,
            pendingComplaints: pendingMap[c._id] || 0,
            avgResolutionHours: avgResMap[c._id] || null,
            maintenanceScore:  Math.round(100 - ((pendingMap[c._id] || 0) / c.total * 100))
        }));

        res.json(insights);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// =============================================================================
// GET /api/incharge/heatmap
// Floor & room-level complaint density. Room "101" → floor=1, room=01
// =============================================================================
exports.getHeatmap = async (req, res) => {
    try {
        const { from, to } = req.query;
        const dateFilter = {};
        if (from) dateFilter.$gte = new Date(from);
        if (to)   dateFilter.$lte = new Date(new Date(to).setHours(23,59,59,999));
        const matchFilter = {
            doorNumber: { $exists: true, $ne: null }
        };
        if (Object.keys(dateFilter).length) matchFilter.createdAt = dateFilter;

        const rawData = await Complaint.aggregate([
            { $match: matchFilter },
            {
                $group: {
                    _id:        "$doorNumber",
                    total:      { $sum: 1 },
                    pending:    { $sum: { $cond: [{ $in: ["$status", ["Pending","Reopened"]] }, 1, 0] } },
                    inProgress: { $sum: { $cond: [{ $eq: ["$status","In Progress"] }, 1, 0] } },
                    resolved:   { $sum: { $cond: [{ $eq: ["$status","Resolved"] }, 1, 0] } },
                    categories: { $push: "$category" }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        const floorMap = {};
        rawData.forEach(room => {
            const door     = String(room._id);
            const floorNum = door.charAt(0);
            if (!floorMap[floorNum]) floorMap[floorNum] = [];
            floorMap[floorNum].push({
                room:       door,
                roomShort:  door.slice(1),
                total:      room.total,
                pending:    room.pending,
                inProgress: room.inProgress,
                resolved:   room.resolved,
                topCategory: getMostFrequent(room.categories)
            });
        });

        const floors = Object.entries(floorMap)
            .sort(([a],[b]) => parseInt(a) - parseInt(b))
            .map(([floor, rooms]) => ({
                floor,
                label: getFloorLabel(floor),
                rooms: rooms.sort((a,b) => a.room.localeCompare(b.room)),
                totalComplaints: rooms.reduce((s,r) => s + r.total, 0)
            }));

        const maxComplaints = Math.max(...rawData.map(r => r.total), 1);
        res.json({ floors, maxComplaints, totalRoomsWithComplaints: rawData.length });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

function getFloorLabel(f) {
    const m = {"0":"Ground Floor","1":"1st Floor","2":"2nd Floor","3":"3rd Floor","4":"4th Floor","5":"5th Floor"};
    return m[f] || `Floor ${f}`;
}

// =============================================================================
// GET /api/incharge/student-complaint-correlation
// Which branch / year raises the most complaints
// =============================================================================
exports.getStudentComplaintCorrelation = async (req, res) => {
    try {
        const [byBranch, byYear] = await Promise.all([
            Complaint.aggregate([
                { $lookup: { from:"users", localField:"studentId", foreignField:"_id", as:"student" } },
                { $unwind: { path:"$student", preserveNullAndEmptyArrays:true } },
                { $group: { _id:"$student.branch", count:{ $sum:1 }, resolved:{ $sum:{ $cond:[{ $eq:["$status","Resolved"] },1,0] } } } },
                { $sort: { count:-1 } }
            ]),
            Complaint.aggregate([
                { $lookup: { from:"users", localField:"studentId", foreignField:"_id", as:"student" } },
                { $unwind: { path:"$student", preserveNullAndEmptyArrays:true } },
                { $group: { _id:"$student.year", count:{ $sum:1 }, resolved:{ $sum:{ $cond:[{ $eq:["$status","Resolved"] },1,0] } } } },
                { $sort: { count:-1 } }
            ])
        ]);
        res.json({ byBranch, byYear });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// =============================================================================
// GET /api/incharge/monthly-trend
// Monthly complaint volume for the past 12 months (created vs resolved)
// =============================================================================
exports.getMonthlyTrend = async (req, res) => {
    try {
        const since = new Date();
        since.setMonth(since.getMonth() - 11);
        since.setDate(1); since.setHours(0,0,0,0);

        const [created, resolved] = await Promise.all([
            Complaint.aggregate([
                { $match: { createdAt: { $gte: since } } },
                { $group: { _id: { $dateToString:{format:"%Y-%m",date:"$createdAt"} }, count:{ $sum:1 } } },
                { $sort: { _id:1 } }
            ]),
            Complaint.aggregate([
                { $match: { resolvedAt:{ $exists:true,$ne:null,$gte:since } } },
                { $group: { _id: { $dateToString:{format:"%Y-%m",date:"$resolvedAt"} }, count:{ $sum:1 } } },
                { $sort: { _id:1 } }
            ])
        ]);

        const resolvedMap = {};
        resolved.forEach(({ _id, count }) => { resolvedMap[_id] = count; });
        const createdMap = {};
        created.forEach(({ _id, count }) => { createdMap[_id] = count; });

        const months = [];
        for (let i = 0; i < 12; i++) {
            const d = new Date();
            d.setMonth(d.getMonth() - (11 - i));
            const key   = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
            const label = d.toLocaleDateString("en-IN", { month:"short", year:"2-digit" });
            months.push({ month:key, label, created: createdMap[key]||0, resolved: resolvedMap[key]||0 });
        }

        res.json(months);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};



// =============================================================================
// GET /api/incharge/sla-breaches
// Complaints breaching SLA (default 48h for pending, 72h for in-progress)
// =============================================================================
exports.getSLABreaches = async (req, res) => {
    try {
        const { hours = 48 } = req.query;
        const h = parseInt(hours) || 48;
        const threshold = new Date(Date.now() - h * 60 * 60 * 1000);

        const breaches = await Complaint.find({
            status: { $in: ["Pending", "In Progress", "Reopened"] },
            createdAt: { $lte: threshold }
        })
        .populate("studentId", "name fullName email prn rollNumber doorNumber year branch")
        .populate("assignedTo", "name")
        .sort({ createdAt: 1 })
        .limit(50);

        const result = breaches.map(c => {
            const hoursElapsed = Math.round((Date.now() - new Date(c.createdAt)) / (1000 * 60 * 60));
            return {
                id:           c._id,
                studentName:  c.studentId?.fullName    || c.studentId?.name || "Unknown",
                rollNumber:   c.studentId?.prn         || c.studentId?.rollNumber || "—",
                prn:          c.studentId?.prn         || c.studentId?.rollNumber || "—",
                room:         c.doorNumber || c.studentId?.doorNumber || "—",
                year:         c.studentId?.year        || "—",
                branch:       c.studentId?.branch      || "—",
                category:     c.category,
                description:  c.description?.slice(0, 80),
                status:       c.status,
                assignedTo:   c.assignedTo?.name || "Unassigned",
                createdAt:    c.createdAt,
                hoursElapsed,
                urgencyLevel: hoursElapsed > 120 ? "CRITICAL" : hoursElapsed > 72 ? "HIGH" : "MEDIUM"
            };
        });

        res.json({ breaches: result, count: result.length, slaHours: h });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// =============================================================================
// GET /api/incharge/comparison
// Current month vs last month stats
// =============================================================================
exports.getComparison = async (req, res) => {
    try {
        const now          = new Date();
        const currStart    = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastStart    = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastEnd      = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

        const [curr, last] = await Promise.all([
            Complaint.aggregate([
                { $match: { createdAt: { $gte: currStart } } },
                {
                    $group: {
                        _id:      null,
                        total:    { $sum: 1 },
                        resolved: { $sum: { $cond: [{ $eq: ["$status", "Resolved"] }, 1, 0] } },
                        pending:  { $sum: { $cond: [{ $in: ["$status", ["Pending", "Reopened"]] }, 1, 0] } },
                        inProg:   { $sum: { $cond: [{ $eq: ["$status", "In Progress"] }, 1, 0] } }
                    }
                }
            ]),
            Complaint.aggregate([
                { $match: { createdAt: { $gte: lastStart, $lte: lastEnd } } },
                {
                    $group: {
                        _id:      null,
                        total:    { $sum: 1 },
                        resolved: { $sum: { $cond: [{ $eq: ["$status", "Resolved"] }, 1, 0] } },
                        pending:  { $sum: { $cond: [{ $in: ["$status", ["Pending", "Reopened"]] }, 1, 0] } },
                        inProg:   { $sum: { $cond: [{ $eq: ["$status", "In Progress"] }, 1, 0] } }
                    }
                }
            ])
        ]);

        const c = curr[0] || { total: 0, resolved: 0, pending: 0, inProg: 0 };
        const l = last[0] || { total: 0, resolved: 0, pending: 0, inProg: 0 };
        const delta = (cv, lv) => lv > 0 ? Math.round(((cv - lv) / lv) * 100) : (cv > 0 ? 100 : 0);

        res.json({
            current: c,
            last:    l,
            deltas: {
                total:    delta(c.total,    l.total),
                resolved: delta(c.resolved, l.resolved),
                pending:  delta(c.pending,  l.pending),
                inProg:   delta(c.inProg,   l.inProg)
            },
            currentMonthLabel: now.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
            lastMonthLabel:    lastStart.toLocaleDateString("en-IN", { month: "long", year: "numeric" })
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// =============================================================================
// GET /api/incharge/top-complainers
// Students who raise the most complaints
// =============================================================================
exports.getTopComplainers = async (req, res) => {
    try {
        const top = await Complaint.aggregate([
            { $group: { _id: "$studentId", count: { $sum: 1 }, resolved: { $sum: { $cond: [{ $eq: ["$status", "Resolved"] }, 1, 0] } }, categories: { $push: "$category" } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
            { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "student" } },
            { $unwind: { path: "$student", preserveNullAndEmptyArrays: true } }
        ]);

        res.json(top.map(s => ({
            studentId:      s._id,
            name:           s.student?.name        || "Unknown",
            rollNumber:     s.student?.rollNumber  || "—",
            year:           s.student?.year        || "—",
            branch:         s.student?.branch      || "—",
            room:           s.student?.doorNumber  || "—",
            count:          s.count,
            resolved:       s.resolved,
            unresolved:     s.count - s.resolved,
            topCategory:    getMostFrequent(s.categories)
        })));
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// =============================================================================
// GET /api/incharge/drill-down
// Paginated filtered complaint list for modal drill-down
// =============================================================================
exports.getDrillDown = async (req, res) => {
    try {
        const { status, category, floor, overdue, recent24h, limit = 100 } = req.query;
        const filter = {};
        if (status)   filter.status   = status;
        if (category) filter.category = category;
        if (floor)    filter.doorNumber = { $regex: `^${floor}` };
        
        if (overdue === 'true' || overdue === true) {
            filter.status = { $in: ["Pending", "In Progress", "Reopened"] };
            filter.createdAt = { $lt: new Date(Date.now() - 48 * 60 * 60 * 1000) };
        } else if (recent24h === 'true' || recent24h === true) {
            filter.createdAt = { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) };
        }

        const complaints = await Complaint.find(filter)
            .populate("studentId",  "name fullName email prn rollNumber doorNumber year branch")
            .populate("assignedTo", "name")
            .sort({ createdAt: -1 })
            .limit(parseInt(limit));

        res.json(complaints.map(c => ({
            id:           c._id,
            studentName:  c.studentId?.fullName   || c.studentId?.name || "Unknown",
            rollNumber:   c.studentId?.prn        || c.studentId?.rollNumber || "—",
            prn:          c.studentId?.prn        || c.studentId?.rollNumber || "—",
            room:         c.doorNumber || c.studentId?.doorNumber || "—",
            year:         c.studentId?.year       || "—",
            branch:       c.studentId?.branch     || "—",
            category:     c.category,
            description:  c.description || "",
            status:       c.status,
            assignedTo:   c.assignedTo?.name || "Unassigned",
            createdAt:    c.createdAt,
            resolvedAt:   c.resolvedAt || null,
            hoursElapsed: Math.round((Date.now() - new Date(c.createdAt)) / (1000 * 60 * 60))
        })));
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// =============================================================================
// Announcements CRUD
// =============================================================================
exports.getAnnouncements = async (req, res) => {
    try {
        const list = await Announcement.find()
            .populate("createdBy", "name role")
            .sort({ pinned: -1, createdAt: -1 })
            .limit(20);
        res.json(list);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

exports.createAnnouncement = async (req, res) => {
    try {
        const { title, body, targetRole = "ALL", priority = "NORMAL", pinned = false } = req.body;
        if (!title || !body) return res.status(400).json({ message: "Title and body are required" });
        // JWT stores 'id' not '_id'
        const createdBy = req.user.id || req.user._id;
        const ann = await Announcement.create({ title, body, targetRole, priority, pinned, createdBy });
        const populated = await Announcement.findById(ann._id).populate("createdBy", "name role");
        res.status(201).json(populated);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

exports.deleteAnnouncement = async (req, res) => {
    try {
        await Announcement.findByIdAndDelete(req.params.id);
        res.json({ message: "Deleted" });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// =============================================================================
// GET /api/incharge/kanban
// Complaints grouped by status for Pipeline view
// Query params: from, to, limit (per-column, default 20)
// =============================================================================
exports.getKanban = async (req, res) => {
    try {
        const { from, to, limit = 20 } = req.query;
        const lim = Math.min(parseInt(limit) || 20, 50);

        const dateFilter = {};
        if (from) dateFilter.$gte = new Date(from);
        if (to)   dateFilter.$lte = new Date(new Date(to).setHours(23,59,59,999));
        const baseFilter = Object.keys(dateFilter).length ? { createdAt: dateFilter } : {};

        const statuses = ["Pending", "In Progress", "Reopened", "Resolved"];

        const [docs, counts] = await Promise.all([
            Promise.all(statuses.map(s =>
                Complaint.find({ ...baseFilter, status: s })
                    .populate("studentId", "name rollNumber doorNumber year branch")
                    .populate("assignedTo", "name")
                    .sort({ createdAt: -1 })
                    .limit(lim)
                    .lean()
            )),
            Promise.all(statuses.map(s =>
                Complaint.countDocuments({ ...baseFilter, status: s })
            ))
        ]);

        const board = {};
        statuses.forEach((s, i) => {
            board[s] = {
                complaints: docs[i].map(c => ({
                    id:          c._id,
                    studentName: c.studentId?.name        || "Unknown",
                    rollNumber:  c.studentId?.rollNumber  || "—",
                    room:        c.doorNumber || c.studentId?.doorNumber || "—",
                    year:        c.studentId?.year        || "—",
                    branch:      c.studentId?.branch      || "—",
                    category:    c.category,
                    description: c.description?.slice(0, 70) || "",
                    assignedTo:  c.assignedTo?.name       || "Unassigned",
                    createdAt:   c.createdAt,
                    hoursElapsed: Math.round((Date.now() - new Date(c.createdAt)) / (1000*60*60))
                })),
                total: counts[i]
            };
        });

        res.json(board);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};



