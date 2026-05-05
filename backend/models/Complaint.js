const mongoose = require("mongoose");

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

    media: [{
        url:  { type: String, required: true },
        type: { type: String, enum: ["image", "video"], required: true }
    }],
    // Legacy: kept for backward compatibility with older complaints
    image: { type: String },

    // ─── Feedback ──────────────────────────────────────────────────────────────
    feedback: {
        isSatisfied: { type: Boolean, default: null },
        text: { type: String },
        media: [{
            url:  { type: String, required: true },
            type: { type: String, enum: ["image", "video"], required: true }
        }]
    },

    // ─── Metadata ──────────────────────────────────────────────────────────────
    doorNumber: { type: String },               // Auto-populated from student profile
    studentId:  { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    // Set when status transitions to "Resolved" — used for avg resolution time analytics
    resolvedAt: { type: Date, default: null }

}, { timestamps: true });

module.exports = mongoose.model("Complaint", ComplaintSchema);