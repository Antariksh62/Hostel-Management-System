const mongoose = require("mongoose");

const IncidentStatusHistorySchema = new mongoose.Schema({
    status:    { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    actor:     { type: String, default: "" },
    note:      { type: String, default: "" }
}, { _id: false });

const IncidentSchema = new mongoose.Schema({
    incidentNumber: {
        type: String,
        required: true,
        unique: true
    },
    serviceType: {
        type: String,
        enum: ["WATER", "ELECTRICITY"],
        required: true
    },
    serviceCategory: {
        type: String,
        enum: ["Plumbing", "Electrical", "NO_WATER_SUPPLY", "NO_ELECTRICITY"],
        required: true
    },
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        default: ""
    },
    status: {
        type: String,
        enum: ["PROPOSED", "CONFIRMED", "IN_PROGRESS", "RESTORATION_REPORTED", "RESOLVED", "REJECTED"],
        default: "PROPOSED"
    },
    floor: {
        type: Number,
        default: null
    },
    // Distinct affected room door numbers (e.g. ["201", "202", "203"])
    affectedRooms: [{
        type: String
    }],
    // Associated individual student complaints (all complaints preserved independently)
    linkedComplaints: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Complaint"
    }],
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    },
    proposedAt: {
        type: Date,
        default: Date.now
    },
    confirmedAt: {
        type: Date,
        default: null
    },
    resolvedAt: {
        type: Date,
        default: null
    },
    resolutionNote: {
        type: String,
        default: ""
    },
    statusHistory: [IncidentStatusHistorySchema]
}, { timestamps: true });

// Indexes for fast lookup by service, status, and creation time
IncidentSchema.index({ serviceType: 1, status: 1 });
IncidentSchema.index({ isResolved: 1, timestamp: -1 });
IncidentSchema.index({ status: 1, createdAt: -1 });
IncidentSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Incident", IncidentSchema);
