const express = require("express");
const router = express.Router();
const { authMiddleware, antiRaggingAccessMiddleware } = require("../middleware/auth");
const controller = require("../controllers/antiRaggingController");

router.use(authMiddleware);
router.use(antiRaggingAccessMiddleware);

router.get("/cases", controller.getAllCases);
router.get("/cases/:id", controller.getCaseById);
router.post("/cases", controller.createCase);
router.patch("/cases/:id/status", controller.updateCaseStatus);
router.post("/cases/:id/notes", controller.addInvestigationNote);
router.post("/cases/:id/actions", controller.recordActionTaken);

module.exports = router;

