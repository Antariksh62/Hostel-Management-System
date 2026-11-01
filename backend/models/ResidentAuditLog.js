const mongoose = require("mongoose");

const ResidentAuditLogSchema = new mongoose.Schema({
    action: {
        type: String,
        enum: ["REVEAL_CONTACT", "UPDATE_CONTACT", "UPDATE_ROOM", "CSV_EXPORT", "CSV_IMPORT"],
        required: true
    },
    performedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    adminName: {
        type: String,
        required: true
    },
    adminRole: {
        type: String,
        enum: ["WARDEN", "INCHARGE", "HEADWARDEN"],
        required: true
    },
    adminEmail: {
        type: String,
        default: ""
    },
    targetStudent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    },
    studentName: {
        type: String,
        default: ""
    },
    studentPRN: {
        type: String,
        default: ""
    },
    details: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    ipAddress: {
        type: String,
        default: ""
    }
}, {
    timestamps: true
});

ResidentAuditLogSchema.index({ action: 1, createdAt: -1 });
ResidentAuditLogSchema.index({ targetStudent: 1, createdAt: -1 });
ResidentAuditLogSchema.index({ performedBy: 1, createdAt: -1 });

module.exports = mongoose.model("ResidentAuditLog", ResidentAuditLogSchema);

