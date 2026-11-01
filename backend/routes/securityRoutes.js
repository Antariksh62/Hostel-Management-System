const express = require("express");
const router = express.Router();
const { authMiddleware, securityAccessMiddleware } = require("../middleware/auth");
const controller = require("../controllers/securityController");

router.use(authMiddleware);
router.use(securityAccessMiddleware);

router.get("/incidents", controller.getAllIncidents);
router.post("/incidents", controller.reportIncident);
router.patch("/incidents/:id/status", controller.updateIncidentStatus);
router.post("/incidents/:id/notes", controller.addIncidentNote);

module.exports = router;

