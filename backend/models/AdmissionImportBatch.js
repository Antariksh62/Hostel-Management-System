const mongoose = require("mongoose");

const AdmissionImportBatchSchema = new mongoose.Schema({
    batchId: {
        type: String,
        required: true,
        unique: true
    },
    originalFileName: {
        type: String,
        required: true
    },
    worksheetName: {
        type: String,
        default: ""
    },
    uploadedBy: {
        id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        name: { type: String, default: "Administrator" },
        role: { type: String, default: "HEADWARDEN" }
    },
    columnMappings: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    totalRows: { type: Number, default: 0 },
    validRows: { type: Number, default: 0 },
    invalidRows: { type: Number, default: 0 },
    approvedRows: { type: Number, default: 0 },
    rejectedRows: { type: Number, default: 0 },
    updatedRecords: { type: Number, default: 0 },
    outcome: {
        type: String,
        enum: ["PREVIEWED", "COMPLETED", "PARTIALLY_COMPLETED", "FAILED"],
        default: "COMPLETED"
    },
    notes: { type: String, default: "" }
}, { timestamps: true });

AdmissionImportBatchSchema.index({ createdAt: -1 });

module.exports = mongoose.model("AdmissionImportBatch", AdmissionImportBatchSchema);

