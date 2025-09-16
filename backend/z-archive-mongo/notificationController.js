const mongoose = require("mongoose");
const Notification = require("../models/Notification");

// ✅ GET all notifications for current user
exports.getNotifications = async (req, res) => {
  try {
    console.log("🔍 Fetching for userId:", req.user._id);
    const notifications = await Notification.find({ recipient: req.user._id }).sort({ createdAt: -1 });
    res.json(notifications);
  } catch (err) {
    console.error("❌ Error in getNotifications:", err.message);
    res.status(500).json({ message: "Error fetching notifications" });
  }
};

// ✅ PATCH single notification as read
exports.markAsRead = async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { isRead: true });
    res.json({ message: "Marked as read" });
  } catch (err) {
    console.error("❌ Error in markAsRead:", err.message);
    res.status(500).json({ message: "Failed to mark notification as read" });
  }
};

// ✅ PATCH all notifications as read
exports.markAllRead = async (req, res) => {
  try {
    await Notification.updateMany({ recipient: req.user._id }, { isRead: true });
    res.json({ message: "All notifications marked as read" });
  } catch (err) {
    console.error("❌ Error in markAllRead:", err.message);
    res.status(500).json({ message: "Failed to mark all as read" });
  }
};

// ✅ DELETE one notification
exports.deleteNotification = async (req, res) => {
  try {
    await Notification.findOneAndDelete({ _id: req.params.id, recipient: req.user._id });
    res.json({ message: "Notification deleted" });
  } catch (err) {
    console.error("❌ Error in deleteNotification:", err.message);
    res.status(500).json({ message: "Failed to delete notification" });
  }
};

// ✅ DELETE all notifications for user
exports.deleteAllNotifications = async (req, res) => {
  try {
    await Notification.deleteMany({ recipient: req.user._id });
    res.json({ message: "All notifications deleted" });
  } catch (err) {
    console.error("❌ Error in deleteAllNotifications:", err.message);
    res.status(500).json({ message: "Failed to delete all notifications" });
  }
};

// ✅ POST create a new notification
exports.createNotification = async (req, res) => {
  try {
    const { recipient, type, message, link, isRead } = req.body;

    if (!recipient || !type || !message) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const newNotification = new Notification({
      recipient: new mongoose.Types.ObjectId(recipient),
      type,
      message,
      link,
      isRead: isRead ?? false,
    });

    const saved = await newNotification.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error("❌ Error creating notification:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ GET paginated notifications
exports.getNotificationsPaginated = async (req, res) => {
  try {
    const { page = 1, limit = 20, isRead } = req.query;

    const filter = { recipient: req.user._id };
    if (isRead === "true") filter.isRead = true;
    if (isRead === "false") filter.isRead = false;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Notification.countDocuments(filter);

    res.json({
      notifications,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      totalCount: total,
    });
  } catch (err) {
    console.error("❌ Error fetching notifications:", err.message);
    res.status(500).json({ message: "Error fetching notifications" });
  }
};

// ✅ POST /seed (admin or dev)
exports.seedNotifications = async (req, res) => {
  try {
    const { recipient, count = 50 } = req.body;

    if (!recipient) {
      return res.status(400).json({ message: "Recipient ID is required." });
    }

    const types = ["job_applied", "job_status_update", "account_activity", "system_announcement"];
    const notifications = [];

    for (let i = 0; i < count; i++) {
      notifications.push({
        recipient,
        type: types[Math.floor(Math.random() * types.length)],
        message: `Sample notification ${i + 1}`,
        link: "/recruiter/dashboard",
        isRead: Math.random() < 0.5,
        createdAt: new Date(Date.now() - i * 1000 * 60),
      });
    }

    await Notification.insertMany(notifications);
    res.status(201).json({ message: `Seeded ${count} notifications.` });
  } catch (error) {
    console.error("❌ Seed failed:", error);
    res.status(500).json({ message: "Failed to seed notifications." });
  }
};
