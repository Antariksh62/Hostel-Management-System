const mongoose = require("mongoose");

const InvestigationNoteSchema = new mongoose.Schema({
    note: { type: String, required: true },
    author: { type: String, required: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    authorRole: { type: String, default: "SQUAD_MEMBER" },
    isConfidential: { type: Boolean, default: true },
    attachments: [{ type: String }],
    timestamp: { type: Date, default: Date.now }
}, { _id: false });

const ActionTakenSchema = new mongoose.Schema({
    actionType: { type: String, required: true }, // e.g. "STATEMENT_RECORDED", "HEARING_HELD", "SUSPENSION_ISSUED", "POLICE_COMPLAINT_FILED", "COUNSELING_ORDERED", "WARNING_LETTER"
    details: { type: String, required: true },
    decidedBy: { type: String, required: true },
    decidedById: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    timestamp: { type: Date, default: Date.now }
}, { _id: false });

const AntiRaggingCaseSchema = new mongoose.Schema({
    caseNumber: {
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
        required: true
    },
    incidentDate: {
        type: Date,
        default: Date.now
    },
    location: {
        type: String,
        default: "Hostel Campus"
    },
    victimInfo: {
        isAnonymous: { type: Boolean, default: false },
        name: { type: String, default: "Confidential" },
        prn: { type: String, default: "" },
        roomNumber: { type: String, default: "" },
        contactNumber: { type: String, default: "" }
    },
    accusedInfo: [{
        name: { type: String },
        prn: { type: String },
        roomNumber: { type: String },
        year: { type: String }
    }],
    severity: {
        type: String,
        enum: ["SERIOUS", "SEVERE", "CRITICAL_EMERGENCY"],
        default: "SERIOUS"
    },
    status: {
        type: String,
        enum: ["CONFIDENTIAL_REPORTED", "UNDER_INVESTIGATION", "HEARING_SCHEDULED", "ACTION_TAKEN", "CLOSED"],
        default: "CONFIDENTIAL_REPORTED"
    },
    assignedOfficer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    },
    assignedOfficerName: {
        type: String,
        default: ""
    },
    investigationNotes: [InvestigationNoteSchema],
    actionsTaken: [ActionTakenSchema],
    evidenceMedia: [{
        url: { type: String, required: true },
        type: { type: String, enum: ["image", "video", "document"], default: "image" }
    }],
    resolvedAt: {
        type: Date,
        default: null
    },
    resolutionSummary: {
        type: String,
        default: ""
    }
}, { timestamps: true });

AntiRaggingCaseSchema.index({ status: 1, createdAt: -1 });
AntiRaggingCaseSchema.index({ severity: 1 });
AntiRaggingCaseSchema.index({ assignedOfficer: 1 });

module.exports = mongoose.model("AntiRaggingCase", AntiRaggingCaseSchema);

