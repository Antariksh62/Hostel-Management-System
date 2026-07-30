const mongoose = require("mongoose");

const AnnouncementSchema = new mongoose.Schema({
    title:      { type: String, required: true, trim: true },
    body:       { type: String, required: true, trim: true },
    targetRole: { type: String, enum: ["ALL", "STUDENT", "STAFF", "WARDEN", "HEADWARDEN"], default: "ALL" },
    priority:   { type: String, enum: ["LOW", "NORMAL", "HIGH", "URGENT"], default: "NORMAL" },
    createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    pinned:     { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model("Announcement", AnnouncementSchema);
