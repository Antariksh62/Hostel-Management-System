const mongoose = require("mongoose");

const StatusHistorySchema = new mongoose.Schema({
    fromStatus: { type: String, required: true },
    toStatus: { type: String, required: true },
    changedBy: {
        id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        name: { type: String, default: "System" },
        role: { type: String, default: "ADMIN" }
    },
    reason: { type: String, default: "" },
    timestamp: { type: Date, default: Date.now }
}, { _id: false });

const AuditTrailSchema = new mongoose.Schema({
    action: { type: String, required: true },
    performedBy: {
        id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        name: { type: String, default: "System" },
        role: { type: String, default: "ADMIN" }
    },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    timestamp: { type: Date, default: Date.now }
}, { _id: false });

const StudentRosterSchema = new mongoose.Schema({
    prn: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        uppercase: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    rollNumber: {
        type: String,
        required: true,
        trim: true
    },
    branch: {
        type: String,
        required: true,
        trim: true,
        uppercase: true
    },
    year: {
        type: String,
        enum: ["FY", "SY", "TY"],
        default: "FY"
    },
    division: {
        type: String,
        trim: true,
        default: ""
    },
    doorNumber: {
        type: String,
        required: true,
        trim: true
    },
    studentMobile: {
        type: String,
        required: true,
        trim: true
    },
    parentMobile: {
        type: String,
        required: true,
        trim: true
    },
    admissionStatus: {
        type: String,
        enum: ["PENDING_APPROVAL", "APPROVED", "REJECTED", "REVOKED"],
        default: "PENDING_APPROVAL"
    },
    registrationStatus: {
        type: String,
        enum: ["NOT_REGISTERED", "REGISTRATION_STARTED", "REGISTERED"],
        default: "NOT_REGISTERED"
    },
    rejectionReason: {
        type: String,
        default: ""
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    },
    importBatchId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "AdmissionImportBatch",
        default: null
    },
    statusHistory: [StatusHistorySchema],
    auditTrail: [AuditTrailSchema]
}, { timestamps: true });

StudentRosterSchema.index({ doorNumber: 1 });
StudentRosterSchema.index({ admissionStatus: 1 });
StudentRosterSchema.index({ admissionStatus: 1, updatedAt: -1 });
StudentRosterSchema.index({ registrationStatus: 1 });
StudentRosterSchema.index({ branch: 1 });
StudentRosterSchema.index({ year: 1 });
StudentRosterSchema.index({ name: 1 });

module.exports = mongoose.model("StudentRoster", StudentRosterSchema);

