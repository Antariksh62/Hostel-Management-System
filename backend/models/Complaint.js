const mongoose = require("mongoose");

const ComplaintSchema = new mongoose.Schema({
    title:       { type: String, required: true },
    description: { type: String, required: true },

    category: {
        type: String,
        enum: [
            "Electrical",
            "Plumbing",
            "Furniture",
            "Cleanliness",
            "Network",
            "Carpentry",
            "Appliance",   // ✅ ADDED (important fix)
            "Other"
        ],
        default: "Other"
    },

    status: {
        type: String,
        enum: ["Pending", "In Progress", "Resolved"],
        default: "Pending"
    },

    media: [{
        url:  { type: String, required: true },
        type: { type: String, enum: ["image", "video"], required: true }
    }],

    image: { type: String },

    doorNumber: { type: String },

    studentId:  { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    resolvedAt: { type: Date, default: null },

    feedback: {
        isResolved: { type: Boolean },
        rating: { type: Number, min: 1, max: 5 },
        comment: { type: String },
        image: { type: String }
    }

}, { timestamps: true });

module.exports = mongoose.model("Complaint", ComplaintSchema);