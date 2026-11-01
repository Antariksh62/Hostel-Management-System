const mongoose = require("mongoose");

const EscalationEventSchema = new mongoose.Schema({
    complaintId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Complaint",
        required: true,
        index: true
    },
    departmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Department",
        required: true
    },
    triggerType: {
        type: String,
        enum: [
            "UNACKNOWLEDGED_DEADLINE",
            "UNSTARTED_DEADLINE",
            "IN_PROGRESS_OVERDUE",
            "PROLONGED_UNRESOLVED",
            "REPEATEDLY_REOPENED"
        ],
        required: true
    },
    escalationCycle: {
        type: Number,
        default: 1
    },
    notifiedRoles: [{
        type: String,
        enum: ["WARDEN", "HEADWARDEN", "INCHARGE", "MAIN_ADMIN"]
    }],
    notifiedUsers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],
    assignedStaffId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    },
    isIntervened: {
        type: Boolean,
        default: false
    },
    intervenedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    },
    interventionNote: {
        type: String,
        default: ""
    },
    timestamp: {
        type: Date,
        default: Date.now,
        required: true,
        index: true
    }
}, { timestamps: true });

EscalationEventSchema.index({ complaintId: 1, escalationCycle: 1 });
EscalationEventSchema.index({ timestamp: -1 });

module.exports = mongoose.model("EscalationEvent", EscalationEventSchema);

