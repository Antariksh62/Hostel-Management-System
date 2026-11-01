const express = require("express");
const router  = express.Router();

const {
    createIncident,
    getAllIncidents,
    getIncidentById,
    confirmIncident,
    rejectIncident,
    updateIncidentStatus,
    assignIncident,
    unlinkComplaint,
    resolveIncident
} = require("../controllers/incidentController");

const { authMiddleware, wardenMiddleware } = require("../middleware/auth");

// All incident routes are accessible by management (Warden, Head Warden, In-Charge)
router.use(authMiddleware, wardenMiddleware);

router.post("/",                    createIncident);
router.get("/",                     getAllIncidents);
router.get("/:id",                  getIncidentById);
router.put("/:id/confirm",          confirmIncident);
router.put("/:id/reject",           rejectIncident);
router.put("/:id/status",           updateIncidentStatus);
router.post("/:id/progress",         (req, res, next) => { req.body.status = "IN_PROGRESS"; updateIncidentStatus(req, res, next); });
router.put("/:id/progress",          (req, res, next) => { req.body.status = "IN_PROGRESS"; updateIncidentStatus(req, res, next); });
router.put("/:id/restoration",       (req, res, next) => { req.body.status = "RESTORATION_REPORTED"; updateIncidentStatus(req, res, next); });
router.put("/:id/assign",           assignIncident);
router.put("/:id/unlink-complaint", unlinkComplaint);
router.post("/:id/resolve",        resolveIncident);
router.put("/:id/resolve",         resolveIncident);

module.exports = router;
