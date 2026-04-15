const express = require("express");
const router = express.Router();

const {
    createComplaint,
    getStudentComplaints,
    getAllComplaints,
    updateComplaintStatus,
    deleteComplaint,
    assignComplaint
} = require("../controllers/complaintController");

const { authMiddleware, wardenMiddleware, wardenOrStaffMiddleware } = require("../middleware/auth");
const upload = require("../middleware/upload");

// Student routes
router.post("/", authMiddleware, upload.single("image"), createComplaint);
router.get("/my-complaints", authMiddleware, getStudentComplaints);

// Shared Warden/Staff routes
router.get("/all", authMiddleware, wardenOrStaffMiddleware, getAllComplaints);
router.put("/:id/status", authMiddleware, wardenOrStaffMiddleware, updateComplaintStatus);

// Warden strictly only routes
router.delete("/:id", authMiddleware, wardenMiddleware, deleteComplaint);
router.put("/assign/:id", authMiddleware, wardenMiddleware, assignComplaint);

module.exports = router;