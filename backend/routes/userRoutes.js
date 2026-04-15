const express = require("express");
const router = express.Router();
const { getProfile, getAllStudents } = require("../controllers/userController");
const { authMiddleware, adminMiddleware } = require("../middleware/auth");

router.get("/profile", authMiddleware, getProfile);
router.get("/students", authMiddleware, adminMiddleware, getAllStudents);

module.exports = router;
