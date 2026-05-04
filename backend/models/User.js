const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
    // Common fields
    name: { type: String },
    email: { type: String, required: true, unique: true },
    password: { type: String }, // Not required for students (OTP-based)
    role: {
        type: String,
        enum: ["STUDENT", "WARDEN", "STAFF"],
        required: true
    },

    // ─── Student-only fields ─────────────────────────────────────────────
    prn: { type: String },                  // Extracted from email, e.g. "f24ce307"
    fullName: { type: String },             // Student's full name
    rollNumber: { type: String },           // Official roll number
    classDiv: { type: String },             // e.g. "CE-A", "CE-B"
    year: {                                 // Year of study
        type: String,
        enum: ["FY", "SY", "TY", "Final Year"]
    },
    doorNumber: { type: String },           // Boys hostel door number
    isVerified: { type: Boolean, default: false }, // True after OTP verification
    profileComplete: { type: Boolean, default: false } // True after profile filled

}, { timestamps: true });

module.exports = mongoose.model("User", UserSchema);
