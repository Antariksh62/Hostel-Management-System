const mongoose = require("mongoose");

// ─── Status History Entry ───────────────────────────────────────────────────────
// Tracks every stage change with a precise timestamp so students, staff, and
// wardens can all see the full lifecycle of a complaint.
const StatusEventSchema = new mongoose.Schema({
    status:    { type: String, required: true },   // e.g. "Pending", "Assigned", "In Progress", "Resolved", "Reopened", "Feedback"
    timestamp: { type: Date,   default: Date.now }, // exact moment of transition
    note:      { type: String, default: "" },       // e.g. "Assigned to Ravi Kumar"
    actor:     { type: String, default: "" }        // Role or name of actor
}, { _id: false });

const ComplaintSchema = new mongoose.Schema({
    title:       { type: String, required: true },
    description: { type: String, required: true },
    category: {
        type: String,
        enum: ["Electrical", "Plumbing", "Furniture", "Cleanliness", "Internet", "Other"],
        default: "Other"
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

    // Set when status transitions to "Resolved"
    resolvedAt:     { type: Date, default: null },
    resolutionNote: { type: String, default: "" }

}, { timestamps: true });

module.exports = mongoose.model("Complaint", ComplaintSchema);