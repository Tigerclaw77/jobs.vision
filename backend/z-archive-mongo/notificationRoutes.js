const express = require("express");
const router = express.Router();

const {
  getNotifications,
  markAsRead,
  markAllRead,
  deleteNotification,
  deleteAllNotifications,
  createNotification,
  seedNotifications,
} = require("../controllers/notificationController");

const { verifyUserRole } = require("../middleware/verifyUserRole");

// ✅ Protect all notification routes with authentication
router.use(verifyUserRole()); // Allow any authenticated user by default

// ✅ Notification endpoints
router.get("/", getNotifications);                     // Get all notifications for current user
router.post("/", createNotification);                  // Create new notification (internal use)
router.patch("/:id/read", markAsRead);                 // Mark single notification as read
router.patch("/read-all", markAllRead);                // Mark all as read
router.delete("/:id", deleteNotification);             // Delete single notification
router.delete("/", deleteAllNotifications);            // Delete all notifications

// ✅ Seed notifications (admin-only)
router.post("/seed", verifyUserRole("admin"), seedNotifications);

module.exports = router;
