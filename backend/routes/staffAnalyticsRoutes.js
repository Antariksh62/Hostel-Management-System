const express = require("express");
const router = express.Router();
const {
    getAnalyticsOverview,
    getStaffTable,
    getStaffDrilldown,
    getComplaintResolutionTimeline
} = require("../controllers/staffAnalyticsController");
const { authMiddleware, residentAdminMiddleware } = require("../middleware/auth");

// Authorized access: HEADWARDEN, WARDEN, and INCHARGE roles only.
// Disallows STAFF, WIFI_INCHARGE, and STUDENT.
router.use(authMiddleware, residentAdminMiddleware);

router.get("/overview", getAnalyticsOverview);
router.get("/staff-table", getStaffTable);
router.get("/staff/:staffId/complaints", getStaffDrilldown);
router.get("/complaint/:id/timeline", getComplaintResolutionTimeline);

module.exports = router;

