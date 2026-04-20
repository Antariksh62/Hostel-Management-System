const express = require("express");
const router = express.Router();

const { register, login } = require("../controllers/authController");
const { sendOTP, verifyOTP, completeProfile } = require("../controllers/otpController");
const { authMiddleware } = require("../middleware/auth");

// ─── Warden / Staff login ─────────────────────────────────────────────────────
router.post("/register", register);
router.post("/login", login);

// ─── Student OTP login ────────────────────────────────────────────────────────
router.post("/student/send-otp", sendOTP);
router.post("/student/verify-otp", verifyOTP);
router.post("/student/complete-profile", authMiddleware, completeProfile);

module.exports = router;
