const mongoose = require("mongoose");

const ComplaintSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, default: "Other" },
    status: { 
        type: String, 
        enum: ["Pending", "In Progress", "Resolved"], 
        default: "Pending" 
    },
    image: { type: String }, // path to the image
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
}, { timestamps: true });

module.exports = mongoose.model("Complaint", ComplaintSchema);
