const express  = require("express");
const router   = express.Router();

const {
    createComplaint,
    getStudentComplaints,
    getComplaintById,
    getAllComplaints,
    getAnalytics,
    updateComplaintStatus,
    deleteComplaint,
    assignComplaint,
    reassignComplaint,
    checkDuplicate,
    getStudentContact,
    getWifiQueue,
    updateWifiComplaintStatus
} = require("../controllers/complaintController");

const {
    authMiddleware,
    wardenMiddleware,
    wardenOrSupervisorMiddleware,
    wardenOrStaffMiddleware,
    wifiInchargeOrWardenMiddleware,
    wifiInchargeOnlyMiddleware
} = require("../middleware/auth");
const { upload, validateFileMagicBytes }                            = require("../middleware/upload");
const { validate, schemas }                                          = require("../middleware/validate");

// ─── Analytics (warden only) — must come before /:id routes ──────────────────
router.get("/analytics", authMiddleware, wardenMiddleware, getAnalytics);

// ─── Duplicate Check & Wi-Fi Specialist Queue ────────────────────────────────
router.get("/check-duplicate", authMiddleware, checkDuplicate);
router.get("/wifi/queue",      authMiddleware, wifiInchargeOnlyMiddleware, getWifiQueue);
router.put("/wifi/:id/status", authMiddleware, wifiInchargeOnlyMiddleware, updateWifiComplaintStatus);

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

// ─── Contact info on-demand (permission protected) ───────────────────────────
router.get("/:id/student-contact", authMiddleware, getStudentContact);

router.post(
    "/:id/feedback",
    authMiddleware,
    upload.fields([
        { name: "images", maxCount: 1 },
        { name: "video",  maxCount: 1 }
    ]),
    validateFileMagicBytes,
    require("../controllers/complaintController").submitFeedback
);

// ─── Shared Warden / Staff routes ─────────────────────────────────────────────
router.get("/",          authMiddleware, wardenOrStaffMiddleware, getAllComplaints);
router.get("/all",       authMiddleware, wardenOrStaffMiddleware, getAllComplaints);
router.get("/:id",       authMiddleware, getComplaintById);
router.put("/:id/status", authMiddleware, wardenOrStaffMiddleware, updateComplaintStatus);

// ─── Management & Department Supervisor Assignment routes ─────────────────────
router.delete("/:id",       authMiddleware, wardenMiddleware, deleteComplaint);
router.put("/assign/:id",   authMiddleware, wardenOrSupervisorMiddleware, assignComplaint);
router.patch("/:id/assign", authMiddleware, wardenOrSupervisorMiddleware, assignComplaint);
router.put("/:id/assign",   authMiddleware, wardenOrSupervisorMiddleware, assignComplaint);
router.post("/:id/reassign", authMiddleware, wardenOrSupervisorMiddleware, reassignComplaint);
router.post("/:id/reopen",   authMiddleware, require("../controllers/complaintController").reopenComplaint);

module.exports = router;