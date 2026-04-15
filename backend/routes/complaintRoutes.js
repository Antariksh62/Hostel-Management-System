const express = require("express");
const router = express.Router();
const { createComplaint, getStudentComplaints, getAllComplaints, updateComplaintStatus, deleteComplaint } = require("../controllers/complaintController");
const { authMiddleware, adminMiddleware } = require("../middleware/auth");
const upload = require("../middleware/upload");

// Student routes
router.post("/", authMiddleware, upload.single("image"), createComplaint);
router.get("/my-complaints", authMiddleware, getStudentComplaints);

// Admin routes
router.get("/all", authMiddleware, adminMiddleware, getAllComplaints);
router.put("/:id/status", authMiddleware, adminMiddleware, updateComplaintStatus);
router.delete("/:id", authMiddleware, adminMiddleware, deleteComplaint);

module.exports = router;
