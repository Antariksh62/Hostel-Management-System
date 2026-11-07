const mongoose = require("mongoose");

// 1. The Base Schema (Fields everyone has)
const options = { discriminatorKey: 'role', timestamps: true };

const UserSchema = new mongoose.Schema({
    name: { type: String },
    email: { type: String, required: true, unique: true },
    password: { type: String },
    role: {
        type: String,
        enum: ["STUDENT", "WARDEN", "STAFF", "HEADWARDEN", "INCHARGE", "WIFI_INCHARGE", "MAIN_ADMIN"],
        required: true
    },
    preferredLanguage: {
        type: String,
        enum: ["en", "hi", "mr"],
        default: "en"
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isAvailable: {
        type: Boolean,
        default: true
    },
    availabilityReason: {
        type: String,
        default: ""
    },
    departmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Department",
        default: null
    },
    authorizedDepartments: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Department"
    }],
    dashboardPermissions: [{
        type: String,
        uppercase: true,
        trim: true
    }],
    dashboardInstances: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "DashboardInstance"
    }],
    exportPermissions: {
        type: Boolean,
        default: false
    }
}, options);

UserSchema.index({ role: 1 });
UserSchema.index({ role: 1, doorNumber: 1 });

const User = mongoose.model("User", UserSchema);

// 2. The Student "Extension"
// This ONLY applies when role is "STUDENT"
const RoomHistoryEntrySchema = new mongoose.Schema({
    previousRoom: { type: String, default: "" },
    newRoom: { type: String, required: true },
    changedBy: { type: String, default: "System" },
    reason: { type: String, default: "Room assignment" },
    changedAt: { type: Date, default: Date.now }
}, { _id: false });

const StudentSchema = new mongoose.Schema({
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
    mobileNumber: { type: String, default: null }, // Student registered contact number
    isVerified: { type: Boolean, default: false },
    profileComplete: { type: Boolean, default: false },

    // Admin-managed Parent / Guardian Contact
    guardianName: { type: String, default: "" },
    guardianRelationship: { type: String, default: "" },
    guardianPhone: { type: String, default: "" },
    guardianSecondaryPhone: { type: String, default: "" },

    // Admin-managed Emergency Contact
    emergencyName: { type: String, default: "" },
    emergencyRelationship: { type: String, default: "" },
    emergencyPhone: { type: String, default: "" },
    emergencySecondaryPhone: { type: String, default: "" },

    // Historical Room Movement Records
    roomHistory: [RoomHistoryEntrySchema]
});

StudentSchema.index({ doorNumber: 1 });
StudentSchema.index({ rollNumber: 1 });
StudentSchema.index({ guardianPhone: 1 });
StudentSchema.index({ emergencyPhone: 1 });

const Student = User.discriminator("STUDENT", StudentSchema);

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

// 5. Dedicated Wi-Fi In-Charge Extension
const WifiIncharge = User.discriminator("WIFI_INCHARGE", new mongoose.Schema({
    officeLocation: { type: String, default: "IT / Networking Cell" },
    shift: { type: String }
}));

const Staff = User.discriminator("STAFF", new mongoose.Schema({
    staffRole: { type: String, default: "Technician" },
    designation: { type: String, default: "Technician" },
    employeeId: { type: String, default: "" },
    phoneNumber: { type: String, default: "" },
    isSupervisor: { type: Boolean, default: false }
}));

// 6. Main Administrator Extension (Supreme Authority)
const MainAdmin = User.discriminator("MAIN_ADMIN", new mongoose.Schema({
    title: { type: String, default: "Main System Administrator" },
    officeLocation: { type: String, default: "Central Administration" }
}));

module.exports = { User, Student, Warden, HeadWarden, Incharge, WifiIncharge, Staff, MainAdmin };
