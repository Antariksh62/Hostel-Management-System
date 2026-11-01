const mongoose = require("mongoose");

const SecurityNoteSchema = new mongoose.Schema({
    note: { type: String, required: true },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    addedByName: { type: String, default: "Security Officer" },
    attachments: [{ type: String }],
    addedAt: { type: Date, default: Date.now }
}, { _id: false });

const SecurityAuditEntrySchema = new mongoose.Schema({
    action: { type: String, required: true },
    actor: { type: String, required: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    timestamp: { type: Date, default: Date.now },
    details: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { _id: false });

const SecurityIncidentSchema = new mongoose.Schema({
    incidentNumber: {
        type: String,
        required: true,
        unique: true,
        uppercase: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        default: ""
    },
    location: {
        type: String,
        required: true,
        trim: true
    },
    severity: {
        type: String,
        enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
        default: "MEDIUM"
    },
    status: {
        type: String,
        enum: ["REPORTED", "INVESTIGATING", "ESCALATED", "RESOLVED", "CLOSED"],
        default: "REPORTED"
    },
    reportedBy: {
        id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        name: { type: String, default: "Staff" },
        role: { type: String, default: "STAFF" }
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    },
    assignedAt: {
        type: Date,
        default: null
    },
    notes: [SecurityNoteSchema],
    resolvedAt: {
        type: Date,
        default: null
    },
    resolutionSummary: {
        type: String,
        default: ""
    },
    auditHistory: [SecurityAuditEntrySchema]
}, { timestamps: true });

SecurityIncidentSchema.index({ status: 1, createdAt: -1 });
SecurityIncidentSchema.index({ severity: 1 });
SecurityIncidentSchema.index({ assignedTo: 1 });

module.exports = mongoose.model("SecurityIncident", SecurityIncidentSchema);

