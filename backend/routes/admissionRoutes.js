const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const { authMiddleware, admissionAdminMiddleware } = require("../middleware/auth");
const admissionController = require("../controllers/admissionController");

// Memory storage for Excel/CSV parsing
const excelUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB max
    fileFilter: (_req, file, cb) => {
        const ext = path.extname(file.originalname || "").toLowerCase();
        if ([".xlsx", ".xls", ".csv"].includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error("File type not allowed. Please upload an Excel file (.xlsx, .xls) or CSV file."));
        }
    }
});

// All admission routes are strictly protected by authMiddleware + admissionAdminMiddleware
// HEADWARDEN and INCHARGE only. WARDEN, WIFI_INCHARGE, STAFF, STUDENT will receive HTTP 403.
router.use(authMiddleware);
router.use(admissionAdminMiddleware);

// ─── Import & Preview Endpoints ──────────────────────────────────────────────
router.post("/worksheets", excelUpload.single("file"), admissionController.getWorksheets);
router.post("/preview", excelUpload.single("file"), admissionController.previewImport);
router.post("/commit", admissionController.commitImport);
router.get("/template", admissionController.downloadTemplate);

// ─── Roster & Lifecycle Endpoints ────────────────────────────────────────────
router.get("/roster", admissionController.getRoster);
router.get("/roster/:id", admissionController.getRosterById);
router.post("/student", admissionController.addManualStudent);
router.patch("/student/:id", admissionController.updateStudentDetails);
router.delete("/roster/:id", admissionController.deleteRosterRecord);
router.post("/approve", admissionController.approveRecords);
router.post("/reject", admissionController.rejectRecords);
router.post("/revoke", admissionController.revokeEligibility);
router.post("/restore", admissionController.restoreEligibility);

// ─── Audit & Batches ─────────────────────────────────────────────────────────
router.get("/batches", admissionController.getBatches);
router.get("/audit-history", admissionController.getAuditHistory);
router.get("/export", admissionController.exportRoster);

module.exports = router;

