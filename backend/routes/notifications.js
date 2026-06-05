// backend/routes/notifications.js
const express = require('express');
const { requireAuth } = require("../middleware/auth");
const { one } = require("../services/db");
const {
  completionTasksForProfile,
  getProfileSelectList,
  profileCompletionForProfile,
  shapeProfile,
  taskToNotification,
} = require("../services/profileDetails");

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const selectList = await getProfileSelectList();
    const row = await one(`select ${selectList} from public.profiles where id = $1`, [
      req.user.id,
    ]);

    if (!row) return res.json({ items: [] });

    const shaped = shapeProfile(row);
    const items = completionTasksForProfile(shaped).map(taskToNotification);
    res.json({
      items,
      profileCompletion: profileCompletionForProfile(shaped),
    });
  } catch (err) {
    console.error("GET /api/notifications error", err);
    res.status(500).json({ error: "Failed to load notifications" });
  }
});

router.patch('/:id/read', requireAuth, async (_req, res) => {
  res.json({ ok: true });
});

router.patch('/read-all', requireAuth, async (_req, res) => {
  res.json({ ok: true });
});

router.delete('/:id', requireAuth, async (_req, res) => {
  res.json({ ok: true });
});

router.delete('/', requireAuth, async (_req, res) => {
  res.json({ ok: true });
});

module.exports = router;
