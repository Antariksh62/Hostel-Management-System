const mongoose = require("mongoose");

const ComplaintSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    status: { 
        type: String, 
        enum: ["Pending", "In Progress", "Resolved"], 
        default: "Pending" 
    },
    image: { type: String }, // path to the image
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
}, { timestamps: true });

module.exports = mongoose.model("Complaint", ComplaintSchema);
