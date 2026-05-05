const mongoose = require("mongoose");

// 1. The Base Schema (Fields everyone has)
const options = { discriminatorKey: 'role', timestamps: true };

const UserSchema = new mongoose.Schema({
    name: { type: String },
    email: { type: String, required: true, unique: true },
    password: { type: String },
    role: {
        type: String,
        enum: ["STUDENT", "WARDEN", "STAFF"],
        required: true
    }
}, options);

const User = mongoose.model("User", UserSchema);

// 2. The Student "Extension"
// This ONLY applies when role is "STUDENT"
const Student = User.discriminator("STUDENT", new mongoose.Schema({
    prn:             { type: String, required: true },
    fullName:        { type: String },           // Set during profile completion
    rollNumber:      { type: String },
    classDiv:        { type: String },           // e.g. "CE-A"
    year:            { 
        type: String, 
        enum: ["FY", "SY", "TY", "Final Year"] 
    },
    doorNumber:      { type: String },
    isVerified:      { type: Boolean, default: false },
    profileComplete: { type: Boolean, default: false }
}));

// 3. The Warden/Staff "Extension"
const Warden = User.discriminator("WARDEN", new mongoose.Schema({
    officeLocation: { type: String },
    shift: { type: String }
}));

module.exports = { User, Student, Warden };