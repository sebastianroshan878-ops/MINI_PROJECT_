const express = require('express');
const Task = require('../models/Task');
const User = require('../models/User');
const { authenticate, authorize, STAFF_ROLES } = require('../middleware/auth');
const { HttpError } = require('../utils/helpers');
const { notify } = require('../services/notify');

const router = express.Router();
const MANAGERS = ['admin', 'manager'];

// GET /api/tasks - managers see everyone's tasks, staff see only their own
router.get('/', authenticate, authorize(...STAFF_ROLES), async (req, res) => {
  const query = {};
  if (!MANAGERS.includes(req.user.role)) query.assignedTo = req.user._id;
  else if (req.query.assignedTo) query.assignedTo = req.query.assignedTo;
  if (req.query.status) query.status = req.query.status;

  const tasks = await Task.find(query)
    .populate('assignedTo', 'name role')
    .populate('assignedBy', 'name')
    .sort({ createdAt: -1 })
    .limit(200);
  res.json(tasks);
});

// POST /api/tasks - assign a task
router.post('/', authenticate, authorize(...MANAGERS), async (req, res) => {
  const { title, description, assignedTo, priority, dueAt } = req.body;
  const member = await User.findById(assignedTo);
  if (!member || member.role === 'customer' || !member.isActive) throw new HttpError(400, 'Choose an active staff member');

  const task = await Task.create({
    title,
    description,
    assignedTo: member._id,
    assignedBy: req.user._id,
    priority,
    dueAt: dueAt || undefined,
  });
  await notify({ user: member._id, type: 'task', title: 'New task assigned', message: title });
  res.status(201).json(task);
});

// PATCH /api/tasks/:id/status - the assigned person (or a manager) updates progress
router.patch('/:id/status', authenticate, authorize(...STAFF_ROLES), async (req, res) => {
  const { status } = req.body;
  if (!['pending', 'in-progress', 'done'].includes(status)) throw new HttpError(400, 'Invalid task status');
  const task = await Task.findById(req.params.id);
  if (!task) throw new HttpError(404, 'Task not found');
  if (!MANAGERS.includes(req.user.role) && String(task.assignedTo) !== String(req.user._id)) {
    throw new HttpError(403, 'This task is assigned to someone else');
  }

  task.status = status;
  task.completedAt = status === 'done' ? new Date() : undefined;
  if (status !== 'done') task.rating = undefined;
  await task.save();
  res.json(task);
});

// PATCH /api/tasks/:id/rate - the manager rates a finished task (feeds the performance record)
router.patch('/:id/rate', authenticate, authorize(...MANAGERS), async (req, res) => {
  const rating = parseInt(req.body.rating, 10);
  if (!rating || rating < 1 || rating > 5) throw new HttpError(400, 'Rating must be from 1 to 5');
  const task = await Task.findById(req.params.id);
  if (!task) throw new HttpError(404, 'Task not found');
  if (task.status !== 'done') throw new HttpError(400, 'Only finished tasks can be rated');
  task.rating = rating;
  await task.save();
  res.json(task);
});

router.delete('/:id', authenticate, authorize(...MANAGERS), async (req, res) => {
  const task = await Task.findByIdAndDelete(req.params.id);
  if (!task) throw new HttpError(404, 'Task not found');
  res.json({ message: 'Task deleted' });
});

module.exports = router;
