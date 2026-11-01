const Notification = require("../models/Notification");
const { getIO } = require("../socket");
const logger = require("../utils/logger");

/**
 * Creates and persists a role-aware administrative notification,
 * then dispatches a real-time event to authorized recipients via Socket.IO.
 */
async function createNotification({
    recipient = null,
    recipientRole = null,
    title,
    message,
    category = "COMPLAINT",
    priority = "MEDIUM",
    entityType = "complaint",
    entityId = null,
    metadata = {},
    dedupKey = null
}) {
    try {
        // Deduplication check: if dedupKey provided, avoid creating duplicates within 5 minutes
        if (dedupKey) {
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            const existing = await Notification.findOne({
                dedupKey,
                createdAt: { $gte: fiveMinutesAgo }
            });
            if (existing) {
                return existing;
            }
        }

        const notification = new Notification({
            recipient,
            recipientRole,
            title,
            message,
            category,
            priority,
            entityType,
            entityId,
            metadata,
            dedupKey
        });

        await notification.save();

        // Real-time dispatch via Socket.IO
        try {
            const io = getIO();
            const payload = {
                id: notification._id,
                title: notification.title,
                message: notification.message,
                category: notification.category,
                priority: notification.priority,
                entityType: notification.entityType,
                entityId: notification.entityId,
                metadata: notification.metadata,
                createdAt: notification.createdAt,
                read: false
            };

            if (recipient) {
                io.to(`user:${recipient}`).emit("notification:new", payload);
            } else if (recipientRole) {
                // Scoped role delivery
                if (recipientRole === "ADMISSION_ADMINS") {
                    io.to("role:HEADWARDEN").to("role:INCHARGE").emit("notification:new", payload);
                } else {
                    io.to(`role:${recipientRole}`).emit("notification:new", payload);
                }
            }
        } catch (socketErr) {
            // Socket might not be initialized in test or background environments
            logger.warn("Socket notification broadcast skipped: " + socketErr.message);
        }

        return notification;
    } catch (err) {
        logger.error("createNotification error:", err);
        throw err;
    }
}

/**
 * Retrieve notifications for a specific user and their role.
 */
async function getUserNotifications(userId, userRole, { limit = 30, page = 1, unreadOnly = false } = {}) {
    const query = {
        $or: [
            { recipient: userId },
            { recipientRole: userRole }
        ]
    };

    // If role is HEADWARDEN or INCHARGE, also include notifications with recipientRole 'ADMISSION_ADMINS'
    if (["HEADWARDEN", "INCHARGE"].includes(userRole)) {
        query.$or.push({ recipientRole: "ADMISSION_ADMINS" });
    }

    if (unreadOnly) {
        query.$and = [
            {
                $or: [
                    { recipient: userId, read: false },
                    { recipientRole: { $in: [userRole, "ADMISSION_ADMINS"] }, readBy: { $ne: userId } }
                ]
            }
        ];
    }

    const skip = (page - 1) * limit;
    const [rawNotifications, total] = await Promise.all([
        Notification.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        Notification.countDocuments(query)
    ]);

    const notifications = rawNotifications.map(n => {
        const isRead = n.recipient ? n.read : (n.readBy || []).some(id => String(id) === String(userId));
        return {
            ...n,
            read: isRead
        };
    });

    return {
        notifications,
        total,
        page,
        totalPages: Math.ceil(total / limit)
    };
}

/**
 * Fast query for unread notification count.
 */
async function getUnreadCount(userId, userRole) {
    const roles = [userRole];
    if (["HEADWARDEN", "INCHARGE"].includes(userRole)) {
        roles.push("ADMISSION_ADMINS");
    }

    const count = await Notification.countDocuments({
        $or: [
            { recipient: userId, read: false },
            { recipientRole: { $in: roles }, readBy: { $ne: userId } }
        ]
    });

    return count;
}

/**
 * Mark a single notification as read by this user.
 */
async function markAsRead(notificationId, userId, userRole) {
    const notif = await Notification.findById(notificationId);
    if (!notif) return null;

    const isDirectRecipient = notif.recipient && String(notif.recipient) === String(userId);
    const isRoleRecipient = notif.recipientRole === userRole ||
        (["HEADWARDEN", "INCHARGE"].includes(userRole) && notif.recipientRole === "ADMISSION_ADMINS");

    if (!isDirectRecipient && !isRoleRecipient) {
        return { success: false, unauthorized: true };
    }

    if (isDirectRecipient) {
        notif.read = true;
        notif.readAt = new Date();
        await notif.save();
    } else {
        // Role-based notification: atomically isolate read state per administrator
        await Notification.findByIdAndUpdate(notificationId, {
            $addToSet: { readBy: userId }
        });
    }

    return { success: true };
}

/**
 * Mark all notifications for this user as read.
 */
async function markAllAsRead(userId, userRole) {
    const roles = [userRole];
    if (["HEADWARDEN", "INCHARGE"].includes(userRole)) {
        roles.push("ADMISSION_ADMINS");
    }

    await Promise.all([
        Notification.updateMany(
            { recipient: userId, read: false },
            { $set: { read: true, readAt: new Date() } }
        ),
        Notification.updateMany(
            { recipientRole: { $in: roles }, readBy: { $ne: userId } },
            { $addToSet: { readBy: userId } }
        )
    ]);

    return { success: true };
}

async function broadcastNotification({ roles = [], userIds = [], title, message, category = "OPERATIONS", priority = "HIGH", type, link, dedupKey }) {
    try {
        if (Array.isArray(roles) && roles.length > 0) {
            for (const r of roles) {
                await createNotification({
                    recipientRole: r,
                    title,
                    message,
                    category,
                    priority,
                    metadata: { type, link },
                    dedupKey: dedupKey ? `${dedupKey}_${r}` : null
                });
            }
        }
        if (Array.isArray(userIds) && userIds.length > 0) {
            for (const uid of userIds) {
                await createNotification({
                    recipient: uid,
                    title,
                    message,
                    category,
                    priority,
                    metadata: { type, link },
                    dedupKey: dedupKey ? `${dedupKey}_${uid}` : null
                });
            }
        }
    } catch (e) {
        logger.error("broadcastNotification error:", e.message);
    }
}

module.exports = {
    createNotification,
    broadcastNotification,
    getUserNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead
};

