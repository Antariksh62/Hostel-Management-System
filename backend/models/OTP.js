const mongoose = require("mongoose");

/**
 * OTP Model — replaces in-memory otpStore.
 *
 * Security design:
 *  - OTP is stored bcrypt-hashed (low rounds = fast, still opaque if DB is leaked)
 *  - `expiresAt` has a TTL index → MongoDB auto-deletes expired documents
 *  - `lastSentAt` enforces server-side resend cooldown (60 s)
 *  - `attempts` tracks wrong guesses; locked out at MAX_ATTEMPTS (5)
 */
const OTPSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        index: true
    },
    otp: {
        type: String,
        required: true     // bcrypt hash of the 6-digit OTP
    },
    expiresAt: {
        type: Date,
        required: true     // TTL index key
    },
    attempts: {
        type: Number,
        default: 0
    },
    lastSentAt: {
        type: Date,
        required: true     // used to enforce resend cooldown
    }
});

// MongoDB TTL index — auto-deletes documents once expiresAt is in the past
OTPSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("OTP", OTPSchema);
