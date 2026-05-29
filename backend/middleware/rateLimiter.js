const rateLimit = require("express-rate-limit");

// ─── OTP Send: 5 requests per 15 minutes per IP ───────────────────────────────
const otpSendLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        message: "Too many OTP requests from this IP. Please try again in 15 minutes."
    }
});

// ─── OTP Verify: 10 attempts per 15 minutes per IP ────────────────────────────
const otpVerifyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        message: "Too many OTP verification attempts. Please try again later."
    }
});

// ─── Staff/Warden Login: 5 attempts per minute per IP ─────────────────────────
const loginLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        message: "Too many login attempts. Please wait a minute and try again."
    }
});

// ─── Staff/Warden Register: 3 attempts per hour per IP ──────────────────────
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 3,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        message: "Too many accounts created from this IP. Please try again after an hour."
    }
});

// ─── Room Booking/Allocation: 10 attempts per 15 minutes per IP ─────────────
const roomLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        message: "Too many room allocation requests from this IP."
    }
});

module.exports = { otpSendLimiter, otpVerifyLimiter, loginLimiter, registerLimiter, roomLimiter };
