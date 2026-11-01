const notificationService = require("../services/notificationService");
const logger = require("../utils/logger");

/**
 * Get notifications for authenticated user
 */
exports.getMyNotifications = async (req, res) => {
    try {
        const { limit = 30, page = 1, unreadOnly = false } = req.query;
        const result = await notificationService.getUserNotifications(
            req.user.id,
            req.user.role,
            {
                limit: parseInt(limit, 10) || 30,
                page: parseInt(page, 10) || 1,
                unreadOnly: unreadOnly === "true" || unreadOnly === true
            }
        );
        res.json(result);
    } catch (err) {
        logger.error("getMyNotifications error:", err);
        res.status(500).json({ message: "Failed to fetch notifications", error: err.message });
    }
};

/**
 * Fast endpoint for unread notification count
 */
exports.getUnreadCount = async (req, res) => {
    try {
        const count = await notificationService.getUnreadCount(req.user.id, req.user.role);
        res.json({ unreadCount: count });
    } catch (err) {
        logger.error("getUnreadCount error:", err);
        res.status(500).json({ message: "Failed to fetch unread count", error: err.message });
    }
};

/**
 * Mark a single notification as read
 */
exports.markRead = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await notificationService.markAsRead(id, req.user.id, req.user.role);
        if (!result) {
            return res.status(404).json({ message: "Notification not found" });
        }
        if (result.unauthorized) {
            return res.status(403).json({ message: "You are not authorized to modify this notification" });
        }
        res.json({ success: true, id });
    } catch (err) {
        logger.error("markRead error:", err);
        res.status(500).json({ message: "Failed to mark as read", error: err.message });
    }
};

/**
 * Mark all notifications as read
 */
exports.markAllRead = async (req, res) => {
    try {
        await notificationService.markAllAsRead(req.user.id, req.user.role);
        res.json({ success: true, message: "All notifications marked as read" });
    } catch (err) {
        logger.error("markAllRead error:", err);
        res.status(500).json({ message: "Failed to mark all as read", error: err.message });
    }
};

