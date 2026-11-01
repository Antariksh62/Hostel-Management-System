const mongoose = require("mongoose");

const ComplaintCategorySchema = new mongoose.Schema({
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
    departmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Department",
        required: true
    },
    description: {
        type: String,
        default: ""
    },
    defaultPriority: {
        type: String,
        enum: ["Low", "Medium", "High", "Emergency"],
        default: "Medium"
    },
    isConfidential: {
        type: Boolean,
        default: false // e.g. for Anti-Ragging categories
    },
    isActive: {
        type: Boolean,
        default: true
    },
    routingKeywords: [{
        type: String,
        trim: true,
        lowercase: true
    }]
}, { timestamps: true });

ComplaintCategorySchema.index({ departmentId: 1, isActive: 1 });

module.exports = mongoose.model("ComplaintCategory", ComplaintCategorySchema);
