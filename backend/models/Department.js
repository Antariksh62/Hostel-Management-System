const mongoose = require("mongoose");

const WorkloadPolicySchema = new mongoose.Schema({
    maxActiveJobsPerEmployee: { type: Number, default: 10 },
    weightPending: { type: Number, default: 1 },
    weightOverdue: { type: Number, default: 2 },
    balancingStrategy: {
        type: String,
        enum: ["LEAST_ACTIVE_LOAD", "ROUND_ROBIN", "SKILL_WEIGHTED"],
        default: "LEAST_ACTIVE_LOAD"
    }
}, { _id: false });

const EscalationPolicySchema = new mongoose.Schema({
    ackDeadlineMinutes: { type: Number, default: 120 },       // 2 hours to acknowledge assignment
    startDeadlineMinutes: { type: Number, default: 240 },     // 4 hours to start work
    resolveDeadlineMinutes: { type: Number, default: 1440 },  // 24 hours to resolve
    reEscalationIntervalMinutes: { type: Number, default: 360 } // Repeat escalation every 6 hours
}, { _id: false });

const DepartmentSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },
    description: {
        type: String,
        default: ""
    },
    template: {
        type: String,
        enum: [
            "PLUMBER", "ELECTRICIAN", "WORKSHOP", "CLEANING",
            "WIFI", "SECURITY", "ANTI_RAGGING", "GENERAL_STAFF"
        ],
        default: "GENERAL_STAFF"
    },
    modules: [{
        type: String,
        trim: true
    }],
    complaintCategories: [{
        type: String,
        trim: true
    }],
    notificationRecipients: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],
    workloadPolicy: {
        type: WorkloadPolicySchema,
        default: () => ({})
    },
    escalationPolicy: {
        type: EscalationPolicySchema,
        default: () => ({})
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isSystem: {
        type: Boolean,
        default: false // Set to true for initial 7 core departments
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    }
}, { timestamps: true });

DepartmentSchema.index({ isActive: 1 });

module.exports = mongoose.model("Department", DepartmentSchema);
