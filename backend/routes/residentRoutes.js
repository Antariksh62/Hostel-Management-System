const express = require("express");
const router = express.Router();
const {
    getResidents,
    getResidentById,
    revealResidentContacts,
    updateResidentContacts,
    updateResidentRoom,
    getResidentComplaints,
    getRoomOccupancy,
    getResidentReports,
    exportResidentsCSV,
    downloadImportTemplate,
    previewImportResidentsCSV,
    confirmImportResidentsCSV
} = require("../controllers/residentController");
const { authMiddleware, residentAdminMiddleware, headWardenOnlyMiddleware } = require("../middleware/auth");

// Base protection: Strictly exclusive to HEADWARDEN, WARDEN and INCHARGE roles
router.use(authMiddleware, residentAdminMiddleware);

// Aggregated & utility routes (must precede /:id)
router.get("/occupancy", getRoomOccupancy);
router.get("/reports", getResidentReports);

// Exclusive HEADWARDEN CSV Import & Export routes (Wardens, Incharge and all other roles are strictly denied 403)
router.get("/export", headWardenOnlyMiddleware, exportResidentsCSV);
router.get("/import-template", headWardenOnlyMiddleware, downloadImportTemplate);
router.post("/import-preview", headWardenOnlyMiddleware, previewImportResidentsCSV);
router.post("/import-confirm", headWardenOnlyMiddleware, confirmImportResidentsCSV);

// Directory collection & individual resident routes
router.get("/", getResidents);
router.get("/:id", getResidentById);
router.post("/:id/reveal-contact", revealResidentContacts);
router.patch("/:id/contacts", updateResidentContacts);
router.patch("/:id/room", updateResidentRoom);
router.get("/:id/complaints", getResidentComplaints);

module.exports = router;
