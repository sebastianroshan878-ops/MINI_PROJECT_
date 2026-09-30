const express = require('express');
const User = require('../models/User');
const Task = require('../models/Task');
const Attendance = require('../models/Attendance');
const { authenticate, authorize } = require('../middleware/auth');
const { HttpError, round2, toDateStr } = require('../utils/helpers');
const { isEmail, isPhone } = require('../utils/validators');
const { STAFF_ROLES } = require('../config/constants');

const router = express.Router();

// GET /api/staff - team list
router.get('/', authenticate, authorize('admin', 'manager'), async (req, res) => {
  res.json(await User.find({ role: { $ne: 'customer' } }).select('-password').sort({ role: 1, name: 1 }));
});

// POST /api/staff - admin adds a team member and chooses the role (role based access control)
router.post('/', authenticate, authorize('admin'), async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const phone = String(req.body.phone || '').trim();
  const { password, role } = req.body;

  if (!name || !email || !password) throw new HttpError(400, 'Name, email and password are required');
  if (!isEmail(email)) throw new HttpError(400, 'Enter a valid email address');
  if (phone && !isPhone(phone)) throw new HttpError(400, 'Phone number must be 10 digits');
  if (!STAFF_ROLES.includes(role)) throw new HttpError(400, 'Choose a staff role');

  const user = await User.create({ name, email, phone, password, role });
  res.status(201).json({ _id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role, isActive: user.isActive });
});

// PUT /api/staff/:id - change role, details, activate / deactivate, reset password
router.put('/:id', authenticate, authorize('admin'), async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user || user.role === 'customer') throw new HttpError(404, 'Staff member not found');

  const isMe = String(user._id) === String(req.user._id);
  if (isMe && (req.body.isActive === false || (req.body.role && req.body.role !== user.role))) {
    throw new HttpError(400, 'You cannot deactivate yourself or change your own role');
  }
  if (req.body.name) user.name = String(req.body.name).trim();
  if (req.body.phone !== undefined) {
    if (req.body.phone && !isPhone(req.body.phone)) throw new HttpError(400, 'Phone number must be 10 digits');
    user.phone = req.body.phone;
  }
  if (req.body.role) {
    if (!STAFF_ROLES.includes(req.body.role)) throw new HttpError(400, 'Choose a staff role');
    user.role = req.body.role;
  }
  if (req.body.isActive !== undefined) user.isActive = !!req.body.isActive;
  if (req.body.password) user.password = req.body.password; // hashed automatically on save
  await user.save();
  res.json({ _id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role, isActive: user.isActive });
});

// GET /api/staff/performance - last 30 days: tasks, ratings and attendance for each team member
router.get('/performance', authenticate, authorize('admin', 'manager'), async (req, res) => {
  const since = new Date(Date.now() - 30 * 86400000);
  const staff = await User.find({ role: { $ne: 'customer' }, isActive: true }).select('name role email');
  const tasks = await Task.find({ createdAt: { $gte: since } });
  const attendance = await Attendance.find({ date: { $gte: toDateStr(since) } });

  const rows = staff.map((member) => {
    const mine = tasks.filter((t) => String(t.assignedTo) === String(member._id));
    const done = mine.filter((t) => t.status === 'done');
    const onTime = done.filter((t) => !t.dueAt || t.completedAt <= t.dueAt).length;
    const rated = done.filter((t) => t.rating);
    const days = attendance.filter((a) => String(a.user) === String(member._id));
    const hours = days.reduce((total, a) => (a.checkOut ? total + (a.checkOut - a.checkIn) / 3600000 : total), 0);
    return {
      _id: member._id,
      name: member.name,
      role: member.role,
      tasksAssigned: mine.length,
      tasksDone: done.length,
      onTimeTasks: onTime,
      avgRating: rated.length ? round2(rated.reduce((s, t) => s + t.rating, 0) / rated.length) : null,
      daysPresent: days.length,
      hoursWorked: round2(hours),
    };
  });
  res.json(rows);
});

module.exports = router;
