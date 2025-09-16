// backend/routes/notifications.js
const express = require('express');
const router = express.Router();

// If you have a notifications table later, swap this to a real query.
// For now return an empty list so the UI stops 404'ing.
router.get('/', async (_req, res) => {
  res.json({ items: [] });
});

module.exports = router;
