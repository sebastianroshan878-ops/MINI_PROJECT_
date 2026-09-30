const express = require('express');
const Notification = require('../models/Notification');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Which notifications belong to the logged in person?
function ownFilter(req) {
  if (req.user.role === 'customer') return req.customer ? { customer: req.customer._id } : null;
  return { $or: [{ forStaff: true }, { user: req.user._id }] };
}

router.get('/', authenticate, async (req, res) => {
  const filter = ownFilter(req);
  if (!filter) return res.json({ notifications: [], unread: 0 });
  const notifications = await Notification.find(filter).sort({ createdAt: -1 }).limit(30);
  const unread = await Notification.countDocuments({ ...filter, read: false });
  res.json({ notifications, unread });
});

router.post('/read-all', authenticate, async (req, res) => {
  const filter = ownFilter(req);
  if (filter) await Notification.updateMany({ ...filter, read: false }, { read: true });
  res.json({ message: 'All notifications marked as read' });
});

router.patch('/:id/read', authenticate, async (req, res) => {
  const filter = ownFilter(req);
  if (filter) await Notification.updateOne({ _id: req.params.id, ...filter }, { read: true });
  res.json({ message: 'Marked as read' });
});

module.exports = router;
