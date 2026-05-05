const express  = require("express");
const router   = express.Router();

const { register, login }                          = require("../controllers/authController");
const { sendOTP, verifyOTP, completeProfile }      = require("../controllers/otpController");
const { authMiddleware }                            = require("../middleware/auth");
const { otpSendLimiter, otpVerifyLimiter, loginLimiter } = require("../middleware/rateLimiter");
const { validate, schemas }                         = require("../middleware/validate");

// ─── Staff / Warden — email + password ────────────────────────────────────────
router.post("/register", validate(schemas.register), register);
router.post("/login",    loginLimiter, validate(schemas.login), login);

// ─── Student — OTP flow ───────────────────────────────────────────────────────
router.post("/student/send-otp",
    otpSendLimiter,
    validate(schemas.sendOTP),
    sendOTP
);

router.post("/student/verify-otp",
    otpVerifyLimiter,
    validate(schemas.verifyOTP),
    verifyOTP
);

router.post("/student/complete-profile",
    authMiddleware,
    validate(schemas.completeProfile),
    completeProfile
);

module.exports = router;
