const express = require('express');
const Waitlist = require('../models/Waitlist');
const { authenticate, authorize } = require('../middleware/auth');
const { promoteWaitlist } = require('../services/reservationService');
const { HttpError } = require('../utils/helpers');

const router = express.Router();
const FRONT_DESK = ['admin', 'manager', 'waiter'];

// GET /api/waitlist?status=waiting
router.get('/', authenticate, authorize(...FRONT_DESK), async (req, res) => {
  const query = {};
  if (req.query.status) query.status = req.query.status;
  res.json(await Waitlist.find(query).populate('reservation', 'code table').sort({ createdAt: 1 }).limit(200));
});

// GET /api/waitlist/mine
router.get('/mine', authenticate, async (req, res) => {
  if (!req.customer) return res.json([]);
  res.json(await Waitlist.find({ customer: req.customer._id }).sort({ createdAt: -1 }));
});

// POST /api/waitlist/promote - check the waiting list now and seat whoever fits
router.post('/promote', authenticate, authorize(...FRONT_DESK), async (req, res) => {
  const promoted = await promoteWaitlist();
  res.json({ promoted: promoted.length, message: promoted.length ? `${promoted.length} guest(s) moved from the waiting list to a table` : 'No table is free for anyone on the waiting list yet' });
});

// PATCH /api/waitlist/:id/cancel
router.patch('/:id/cancel', authenticate, async (req, res) => {
  const entry = await Waitlist.findById(req.params.id);
  if (!entry) throw new HttpError(404, 'Waiting list entry not found');
  const isOwner = req.customer && String(entry.customer) === String(req.customer._id);
  if (!isOwner && !FRONT_DESK.includes(req.user.role)) throw new HttpError(403, 'You cannot change this entry');
  if (entry.status !== 'waiting') throw new HttpError(400, `This entry is already ${entry.status}`);
  entry.status = 'cancelled';
  await entry.save();
  res.json(entry);
});

module.exports = router;
