const logger = require("../utils/logger");
const Complaint = require("../models/Complaint");
const {
    getOverallPerformanceAnalytics,
    getStaffPerformanceTable,
    getStaffComplaintDrilldown,
    analyzeComplaintLifecycle
} = require("../services/staffPerformanceService");

/**
 * GET /api/staff-analytics/overview
 * High-level summary KPI cards and breakdowns.
 * Accessible to: HEADWARDEN, WARDEN, INCHARGE.
 * Enforces strict Wi-Fi isolation for WARDEN.
 */
exports.getAnalyticsOverview = async (req, res) => {
    try {
        const userRole = req.user.role;
        const filters = {
            category: req.query.category,
            floor: req.query.floor,
            status: req.query.status,
            outcome: req.query.outcome,
            staffId: req.query.staffId,
            startDate: req.query.startDate,
            endDate: req.query.endDate
        };

        const data = await getOverallPerformanceAnalytics(userRole, filters);
        res.json(data);
    } catch (err) {
        logger.error("getAnalyticsOverview error:", err);
        res.status(500).json({ message: "Failed to generate staff analytics overview", error: err.message });
    }
};

/**
 * GET /api/staff-analytics/staff-table
 * Individual staff member performance breakdown table.
 * Accessible to: HEADWARDEN, WARDEN, INCHARGE.
 */
exports.getStaffTable = async (req, res) => {
    try {
        const userRole = req.user.role;
        const filters = {
            category: req.query.category,
            floor: req.query.floor,
            status: req.query.status,
            startDate: req.query.startDate,
            endDate: req.query.endDate
        };

        const staffRows = await getStaffPerformanceTable(userRole, filters);
        res.json({ staff: staffRows });
    } catch (err) {
        logger.error("getStaffTable error:", err);
        res.status(500).json({ message: "Failed to load staff performance table", error: err.message });
    }
};

/**
 * GET /api/staff-analytics/staff/:staffId/complaints
 * Detailed list of complaints assigned to or resolved by this staff member.
 * Accessible to: HEADWARDEN, WARDEN, INCHARGE.
 */
exports.getStaffDrilldown = async (req, res) => {
    try {
        const { staffId } = req.params;
        const userRole = req.user.role;
        const { User } = require("../models/User");

        // Strict Wi-Fi isolation: Warden cannot inspect Wi-Fi Specialist drilldown
        if (userRole === "WARDEN" && staffId !== "UNATTRIBUTED") {
            const targetUser = await User.findById(staffId).select("role staffRole department").lean();
            if (targetUser && (
                targetUser.role === "WIFI_INCHARGE" ||
                targetUser.staffRole === "Wi-Fi Specialist" ||
                targetUser.department === "Internet"
            )) {
                return res.status(403).json({ message: "Access denied: Wi-Fi specialist data restricted from Warden jurisdiction" });
            }
        }

        const filters = {
            category: req.query.category,
            floor: req.query.floor,
            status: req.query.status,
            startDate: req.query.startDate,
            endDate: req.query.endDate
        };

        const complaints = await getStaffComplaintDrilldown(userRole, staffId, filters);
        res.json({ staffId, count: complaints.length, complaints });
    } catch (err) {
        logger.error("getStaffDrilldown error:", err);
        res.status(500).json({ message: "Failed to load staff complaint drill-down", error: err.message });
    }
};

/**
 * GET /api/staff-analytics/complaint/:id/timeline
 * Detailed resolution attempt timeline for a specific complaint.
 */
exports.getComplaintResolutionTimeline = async (req, res) => {
    try {
        const { id } = req.params;
        const userRole = req.user.role;

        const complaint = await Complaint.findById(id)
            .populate("assignedTo", "name email role staffRole")
            .populate("studentId", "name fullName email prn rollNumber branch year doorNumber")
            .lean();

        if (!complaint) {
            return res.status(404).json({ message: "Complaint not found" });
        }

        // Strict Wi-Fi isolation check for WARDEN
        if (userRole === "WARDEN" && (complaint.category === "Internet" || complaint.quickCategory === "WIFI_NOT_WORKING")) {
            return res.status(403).json({ message: "Access denied: Specialist ticket outside Warden jurisdiction" });
        }

        const lifecycle = analyzeComplaintLifecycle(complaint);
        res.json({ complaint: lifecycle });
    } catch (err) {
        logger.error("getComplaintResolutionTimeline error:", err);
        res.status(500).json({ message: "Failed to load resolution timeline", error: err.message });
    }
};

