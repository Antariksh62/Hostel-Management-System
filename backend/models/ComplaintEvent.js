const mongoose = require("mongoose");

const ComplaintEventSchema = new mongoose.Schema({
    complaintId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Complaint",
        required: true,
        index: true
    },
    eventType: {
        type: String,
        required: true,
        enum: [
            "SUBMITTED",
            "ROUTED",
            "ASSIGNED",
            "REASSIGNED",
            "NOTIFICATION_SENT",
            "ACKNOWLEDGED",
            "WORK_STARTED",
            "WORK_PAUSED",
            "WORK_RESUMED",
            "NOTE_ADDED",
            "ATTACHMENT_ADDED",
            "ESCALATED",
            "MANAGEMENT_ACKNOWLEDGED",
            "WORK_COMPLETED",
            "AWAITING_CONFIRMATION",
            "STUDENT_CONFIRMED",
            "STUDENT_REJECTED",
            "REOPENED",
            "CLOSED",
            "DEPARTMENT_TRANSFERRED"
        ]
    },
    actor: {
        id: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        name: { type: String, default: "System" },
        role: { type: String, default: "SYSTEM" }
    },
    previousState: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    newState: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    note: {
        type: String,
        default: ""
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    // Server-generated authoritative UTC timestamp
    timestamp: {
        type: Date,
        default: Date.now,
        required: true,
        index: true
    }
}, { timestamps: false });

ComplaintEventSchema.index({ complaintId: 1, timestamp: 1 });
ComplaintEventSchema.index({ eventType: 1, timestamp: -1 });

module.exports = mongoose.model("ComplaintEvent", ComplaintEventSchema);

