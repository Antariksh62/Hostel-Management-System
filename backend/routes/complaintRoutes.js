const express  = require("express");
const router   = express.Router();

const {
    createComplaint,
    getStudentComplaints,
    getAllComplaints,
    getAnalytics,
    updateComplaintStatus,
    deleteComplaint,
    assignComplaint
} = require("../controllers/complaintController");

const { authMiddleware, wardenMiddleware, wardenOrStaffMiddleware } = require("../middleware/auth");
const { upload, validateFileMagicBytes }                            = require("../middleware/upload");
const { validate, schemas }                                          = require("../middleware/validate");

// ─── Analytics (warden only) — must come before /:id routes ──────────────────
router.get("/analytics", authMiddleware, wardenMiddleware, getAnalytics);

// ─── Student routes ───────────────────────────────────────────────────────────
router.post(
    "/",
    authMiddleware,
    upload.fields([
        { name: "images", maxCount: 5 },
        { name: "video",  maxCount: 1 }
    ]),
    validateFileMagicBytes,
    validate(schemas.createComplaint),
    createComplaint
);

router.get("/my-complaints", authMiddleware, getStudentComplaints);

// ─── Shared Warden / Staff routes ─────────────────────────────────────────────
router.get("/all",       authMiddleware, wardenOrStaffMiddleware, getAllComplaints);
router.put("/:id/status", authMiddleware, wardenOrStaffMiddleware, updateComplaintStatus);

// ─── Warden-only routes ───────────────────────────────────────────────────────
router.delete("/:id",       authMiddleware, wardenMiddleware, deleteComplaint);
router.put("/assign/:id",   authMiddleware, wardenMiddleware, assignComplaint);

module.exports = router;