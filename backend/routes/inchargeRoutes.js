const express = require("express");
const router  = express.Router();

const {
    getOverview, getComplaintAnalytics, getStaffPerformance, getWardenPerformance,
    getRoomAnalytics, getStudentAnalytics, getRepeatAnalysis, getKPIs,
    getPredictiveInsights, getMaintenanceInsights, getHeatmap,
    getStudentComplaintCorrelation, getMonthlyTrend,
    getSLABreaches, getComparison, getTopComplainers, getDrillDown,
    getAnnouncements, createAnnouncement, deleteAnnouncement,
    getKanban
} = require("../controllers/inchargeDashboardController");

const { authMiddleware } = require("../middleware/auth");

// INCHARGE or HEADWARDEN only
const seniorOnly = (req, res, next) => {
    if (req.user && ["INCHARGE", "HEADWARDEN"].includes(req.user.role)) return next();
    return res.status(403).json({ message: "Access denied: Senior management only" });
};

router.use(authMiddleware, seniorOnly);

// ── Core analytics ────────────────────────────────────────────────────────────
router.get("/overview",                       getOverview);
router.get("/complaint-analytics",            getComplaintAnalytics);
router.get("/staff-performance",              getStaffPerformance);
router.get("/warden-performance",             getWardenPerformance);
router.get("/room-analytics",                 getRoomAnalytics);
router.get("/student-analytics",              getStudentAnalytics);
router.get("/repeat-analysis",                getRepeatAnalysis);
router.get("/kpis",                           getKPIs);
router.get("/predictive",                     getPredictiveInsights);
router.get("/maintenance",                    getMaintenanceInsights);
router.get("/heatmap",                        getHeatmap);
router.get("/student-complaint-correlation",  getStudentComplaintCorrelation);
router.get("/monthly-trend",                  getMonthlyTrend);

// ── Advanced analytics ────────────────────────────────────────────────────────
router.get("/sla-breaches",    getSLABreaches);
router.get("/comparison",      getComparison);
router.get("/top-complainers", getTopComplainers);
router.get("/drill-down",      getDrillDown);
router.get("/kanban",          getKanban);

// ── Announcements ─────────────────────────────────────────────────────────────
router.get("/announcements",           getAnnouncements);
router.post("/announcements",          createAnnouncement);
router.delete("/announcements/:id",    deleteAnnouncement);

module.exports = router;
