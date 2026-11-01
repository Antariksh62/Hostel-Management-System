const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema({
    // If targeted at a specific individual user (e.g. staff member)
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    },
    // If targeted at an administrative role (MAIN_ADMIN, HEADWARDEN, WARDEN, INCHARGE, WIFI_INCHARGE, STAFF, ADMISSION_ADMINS)
    recipientRole: {
        type: String,
        enum: ["MAIN_ADMIN", "HEADWARDEN", "WARDEN", "INCHARGE", "WIFI_INCHARGE", "STAFF", "ADMISSION_ADMINS"],
        default: null
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    message: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        enum: ["COMPLAINT", "ADMISSION", "SYSTEM", "ESCALATION", "INCIDENT", "OPERATIONS", "SECURITY", "ANTI_RAGGING"],
        default: "COMPLAINT"
    },
    priority: {
        type: String,
        enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
        default: "MEDIUM"
    },
    entityType: {
        type: String,
        enum: ["complaint", "admission", "room", "user", "import", "system"],
        default: "complaint"
    },
    entityId: {
        type: String,
        default: null
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    // User IDs who have marked this notification as read
    readBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],
    // Individual read flag for single-recipient notifications
    read: {
        type: Boolean,
        default: false
    },
    readAt: {
        type: Date,
        default: null
    },
    // Deduplication key to prevent duplicate noise within a short time window
    dedupKey: {
        type: String,
        default: null,
        index: true
    }
}, { timestamps: true });

NotificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });
NotificationSchema.index({ recipientRole: 1, createdAt: -1 });
NotificationSchema.index({ readBy: 1 });
NotificationSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Notification", NotificationSchema);
