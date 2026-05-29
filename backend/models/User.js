const mongoose = require("mongoose");

// 1. The Base Schema (Fields everyone has)
const options = { discriminatorKey: 'role', timestamps: true };

const UserSchema = new mongoose.Schema({
    name: { type: String },
    email: { type: String, required: true, unique: true },
    password: { type: String },
    role: {
        type: String,
        enum: ["STUDENT", "WARDEN", "STAFF", "HEADWARDEN", "INCHARGE"],
        required: true
    }
}, options);

const User = mongoose.model("User", UserSchema);

// 2. The Student "Extension"
// This ONLY applies when role is "STUDENT"
const Student = User.discriminator("STUDENT", new mongoose.Schema({
    prn: { type: String, required: true, unique: true },
    fullName: { type: String },           // Set during profile completion
    rollNumber: { type: String },
    classDiv: { type: String },           // e.g. "SY-1" or "FY-3"
    year: {
        type: String,
        enum: ["FY", "SY", "TY"]                // Final Year not allowed in hostel
    },
    branch: { type: String },           // Auto-parsed from PRN: CE/ENTC/IT/AIDS/ECE
    joiningYear: { type: Number },           // e.g. 2024 — parsed from PRN (f24... → 2024)
    doorNumber: { type: String },
    isVerified: { type: Boolean, default: false },
    profileComplete: { type: Boolean, default: false }
}));

// 3. The Warden/Staff "Extension"
const Warden = User.discriminator("WARDEN", new mongoose.Schema({
    officeLocation: { type: String },
    shift: { type: String }
}));

// 4. HeadWarden and Incharge Extensions
const HeadWarden = User.discriminator("HEADWARDEN", new mongoose.Schema({
    officeLocation: { type: String }
}));

const Incharge = User.discriminator("INCHARGE", new mongoose.Schema({
    officeLocation: { type: String }
}));

module.exports = { User, Student, Warden, HeadWarden, Incharge };