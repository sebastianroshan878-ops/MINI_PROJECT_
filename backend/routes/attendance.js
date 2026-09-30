const express = require('express');
const Attendance = require('../models/Attendance');
const { authenticate, authorize, STAFF_ROLES } = require('../middleware/auth');
const { HttpError, toDateStr } = require('../utils/helpers');

const router = express.Router();

// GET /api/attendance/today - my record for today (or null)
router.get('/today', authenticate, authorize(...STAFF_ROLES), async (req, res) => {
  res.json(await Attendance.findOne({ user: req.user._id, date: toDateStr() }));
});

// GET /api/attendance/mine - my last 14 days
router.get('/mine', authenticate, authorize(...STAFF_ROLES), async (req, res) => {
  res.json(await Attendance.find({ user: req.user._id }).sort({ date: -1 }).limit(14));
});

// POST /api/attendance/check-in
router.post('/check-in', authenticate, authorize(...STAFF_ROLES), async (req, res) => {
  const date = toDateStr();
  if (await Attendance.findOne({ user: req.user._id, date })) throw new HttpError(409, 'You have already checked in today');
  const record = await Attendance.create({ user: req.user._id, date, checkIn: new Date() });
  res.status(201).json(record);
});

// POST /api/attendance/check-out
router.post('/check-out', authenticate, authorize(...STAFF_ROLES), async (req, res) => {
  const record = await Attendance.findOne({ user: req.user._id, date: toDateStr() });
  if (!record) throw new HttpError(400, 'Check in first');
  if (record.checkOut) throw new HttpError(409, 'You have already checked out today');
  record.checkOut = new Date();
  await record.save();
  res.json(record);
});

// GET /api/attendance?date=2026-09-25 - everyone's attendance for a day (manager / admin)
router.get('/', authenticate, authorize('admin', 'manager'), async (req, res) => {
  const date = req.query.date || toDateStr();
  res.json(await Attendance.find({ date }).populate('user', 'name role').sort({ checkIn: 1 }));
});

module.exports = router;
