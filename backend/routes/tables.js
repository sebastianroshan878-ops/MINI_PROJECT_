const express = require('express');
const Table = require('../models/Table');
const Reservation = require('../models/Reservation');
const { authenticate, authorize, STAFF_ROLES } = require('../middleware/auth');
const { validateSlot, getFreeTables } = require('../services/reservationService');
const { HttpError, endOfDay } = require('../utils/helpers');

const router = express.Router();

// GET /api/tables/availability?date=2026-09-25&time=19:30&guests=4  (public)
// Which tables can still be booked for that time?
router.get('/availability', async (req, res) => {
  const { date, time } = req.query;
  const { startAt, endAt, guests } = await validateSlot(date, time, req.query.guests || 1);
  const free = await getFreeTables({ startAt, endAt, guests });
  res.json({
    date,
    time,
    guests,
    count: free.length,
    tables: free.map((t) => ({ _id: t._id, number: t.number, capacity: t.capacity, location: t.location })),
  });
});

// GET /api/tables - live table board for staff
// "reserved" is not stored: a table shows as reserved when a booking starts within the next 45 minutes.
router.get('/', authenticate, authorize(...STAFF_ROLES), async (req, res) => {
  const tables = await Table.find({ isActive: true }).sort({ number: 1 });
  const now = new Date();
  const soon = new Date(now.getTime() + 45 * 60000);

  const upcoming = await Reservation.find({
    status: 'confirmed',
    endAt: { $gt: now },
    startAt: { $lte: endOfDay(now) },
  }).sort({ startAt: 1 });

  const result = tables.map((table) => {
    const next = upcoming.find((r) => String(r.table) === String(table._id)) || null;
    let effectiveStatus = table.status;
    if (table.status === 'available' && next && next.startAt <= soon) effectiveStatus = 'reserved';
    return {
      ...table.toObject(),
      effectiveStatus,
      nextReservation: next
        ? { code: next.code, name: next.customerName, guests: next.guests, time: next.time }
        : null,
    };
  });
  res.json(result);
});

// PATCH /api/tables/:id/status - waiter marks a table available / occupied / cleaning
router.patch('/:id/status', authenticate, authorize('admin', 'manager', 'waiter'), async (req, res) => {
  const { status } = req.body;
  if (!['available', 'occupied', 'cleaning'].includes(status)) throw new HttpError(400, 'Invalid table status');
  const table = await Table.findByIdAndUpdate(req.params.id, { status }, { new: true, runValidators: true });
  if (!table) throw new HttpError(404, 'Table not found');
  res.json(table);
});

// POST /api/tables - add a table (manager / admin)
router.post('/', authenticate, authorize('admin', 'manager'), async (req, res) => {
  const { number, capacity, location } = req.body;
  const table = await Table.create({ number, capacity, location });
  res.status(201).json(table);
});

// PUT /api/tables/:id - change seats or area
router.put('/:id', authenticate, authorize('admin', 'manager'), async (req, res) => {
  const table = await Table.findById(req.params.id);
  if (!table) throw new HttpError(404, 'Table not found');
  ['number', 'capacity', 'location'].forEach((key) => {
    if (req.body[key] !== undefined) table[key] = req.body[key];
  });
  await table.save();
  res.json(table);
});

// DELETE /api/tables/:id - hide a table (kept in the database so old bookings still make sense)
router.delete('/:id', authenticate, authorize('admin', 'manager'), async (req, res) => {
  const table = await Table.findById(req.params.id);
  if (!table) throw new HttpError(404, 'Table not found');
  const busy = await Reservation.findOne({ table: table._id, status: { $in: ['confirmed', 'seated'] }, endAt: { $gt: new Date() } });
  if (busy) throw new HttpError(409, 'This table has upcoming reservations. Move them first');
  table.isActive = false;
  await table.save();
  res.json({ message: 'Table removed' });
});

module.exports = router;
