const mongoose = require("mongoose");

// ─── Status History Entry ───────────────────────────────────────────────────────
// Tracks every stage change with a precise timestamp so students, staff, and
// wardens can all see the full lifecycle of a complaint.
const StatusEventSchema = new mongoose.Schema({
    status:    { type: String, required: true },   // e.g. "Pending", "Assigned", "In Progress", "Resolved", "Reopened", "Feedback"
    timestamp: { type: Date,   default: Date.now }, // exact moment of transition
    note:      { type: String, default: "" },       // e.g. "Assigned to Ravi Kumar"
    actor:     { type: String, default: "" },       // Role or name of actor
    actorId:   { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, // immutable user ID of who performed action
    staffId:   { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }  // specific staff member performing/assigned to work
}, { _id: false });

const ComplaintSchema = new mongoose.Schema({
    title:       { type: String, required: true },
    description: { type: String, default: "" },
    category: {
        type: String,
        required: true,
        trim: true,
        default: "Other"
    },
    departmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Department",
        default: null
    },
    lifecycleState: {
        type: String,
        enum: [
            "SUBMITTED", "ROUTED", "ASSIGNED", "ACCEPTED", "IN_PROGRESS",
            "RESOLVED", "AWAITING_STUDENT_CONFIRMATION", "CONFIRMED", "REOPENED", "CLOSED"
        ],
        default: "SUBMITTED"
    },
    isConfidential: {
        type: Boolean,
        default: false // e.g. strictly true for Anti-Ragging
    },
    isAntiRagging: {
        type: Boolean,
        default: false
    },
    isSecurity: {
        type: Boolean,
        default: false
    },
    quickCategory: {
        type: String,
        default: null
    },
    incidentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Incident",
        default: null
    },
    status: {
        type: String,
        enum: ["Pending", "In Progress", "Resolved", "Reopened"],
        default: "Pending"
    },

    // ─── Full status timeline ───────────────────────────────────────────────────
    // Every stage change is appended here with an exact timestamp.
    statusHistory: [StatusEventSchema],

    media: [{
        url:  { type: String, required: true },
        type: { type: String, enum: ["image", "video"], required: true }
    }],
    // Legacy: kept for backward compatibility with older complaints
    image: { type: String },

    // ─── Feedback ──────────────────────────────────────────────────────────────
    feedback: {
        isSatisfied: { type: Boolean, default: null },
        text:        { type: String },
        submittedAt: { type: Date,    default: null },  // when the student submitted feedback
        media: [{
            url:  { type: String, required: true },
            type: { type: String, enum: ["image", "video"], required: true }
        }]
    },

    // ─── Metadata ──────────────────────────────────────────────────────────────
    doorNumber: { type: String },               // Auto-populated from student profile
    studentId:  { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    assignedAt: { type: Date, default: null },  // Exact time the complaint was assigned to staff
    acceptedAt: { type: Date, default: null },  // Exact time staff accepted responsibility
    workStartedAt: { type: Date, default: null }, // Exact time staff started work

    // Escalation tracking
    escalationLevel: { type: Number, default: 0 },
    lastEscalatedAt: { type: Date, default: null },

    // Reassignment history
    reassignmentHistory: [{
        previousStaff: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        newStaff: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        reason: { type: String, required: true },
        reassignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        reassignedByRole: { type: String, default: "MANAGEMENT" },
        timestamp: { type: Date, default: Date.now }
    }],

    // Work Notes & Evidence
    workNotes: [{
        note: { type: String, required: true },
        addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        addedByName: { type: String, default: "Staff" },
        addedAt: { type: Date, default: Date.now },
        attachments: [{ type: String }]
    }],
    beforePhotos: [{ type: String }],
    afterPhotos: [{ type: String }],

    // Set when status transitions to "Resolved"
    resolvedAt:     { type: Date, default: null },
    resolutionNote: { type: String, default: "" },

    // ─── Roommate Association & Room Confirmation ─────────────────────────────
    parentComplaintId:    { type: mongoose.Schema.Types.ObjectId, ref: "Complaint", default: null },
    associatedComplaints: [{ type: mongoose.Schema.Types.ObjectId, ref: "Complaint" }],
    roomConfirmedWorking: { type: Boolean, default: false },
    followUpRequired:     { type: Boolean, default: false },
    roommateConfirmation: {
        confirmedBy: { type: String, default: null },
        confirmedAt: { type: Date, default: null },
        message:     { type: String, default: null }
    }

}, { timestamps: true });

// Optimized indexes for high-volume analytics queries & isolation filters
ComplaintSchema.index({ departmentId: 1, status: 1 });
ComplaintSchema.index({ isConfidential: 1 });
ComplaintSchema.index({ isAntiRagging: 1 });
ComplaintSchema.index({ isSecurity: 1 });
ComplaintSchema.index({ lifecycleState: 1 });
ComplaintSchema.index({ category: 1, status: 1, createdAt: -1 });
ComplaintSchema.index({ assignedTo: 1, status: 1, createdAt: -1 });
ComplaintSchema.index({ assignedTo: 1, createdAt: -1 });
ComplaintSchema.index({ status: 1, createdAt: -1 });
ComplaintSchema.index({ incidentId: 1 });
ComplaintSchema.index({ "statusHistory.staffId": 1 });
ComplaintSchema.index({ "statusHistory.actorId": 1 });
ComplaintSchema.index({ doorNumber: 1 });
ComplaintSchema.index({ createdAt: -1 });
ComplaintSchema.index({ studentId: 1, createdAt: -1 });

module.exports = mongoose.model("Complaint", ComplaintSchema);
