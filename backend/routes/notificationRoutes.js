const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middleware/auth");
const notificationController = require("../controllers/notificationController");

router.use(authMiddleware);

router.get("/", notificationController.getMyNotifications);
router.get("/unread-count", notificationController.getUnreadCount);
router.patch("/:id/read", notificationController.markRead);
router.post("/mark-all-read", notificationController.markAllRead);

module.exports = router;

