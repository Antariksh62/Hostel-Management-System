const mongoose = require("mongoose");

const AuditLogSchema = new mongoose.Schema({
    action: {
        type: String,
        required: true,
        index: true
    },
    performedBy: {
        id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        name: { type: String, required: true },
        role: { type: String, required: true },
        email: { type: String }
    },
    target: {
        id: { type: mongoose.Schema.Types.ObjectId, default: null },
        model: { type: String, default: "" },
        identifier: { type: String, default: "" }
    },
    details: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    ipAddress: {
        type: String,
        default: ""
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    }
}, { timestamps: false });

AuditLogSchema.index({ action: 1, timestamp: -1 });
AuditLogSchema.index({ "performedBy.id": 1, timestamp: -1 });
AuditLogSchema.index({ "target.id": 1, timestamp: -1 });

module.exports = mongoose.model("AuditLog", AuditLogSchema);

