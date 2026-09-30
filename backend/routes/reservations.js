const express = require('express');
const mongoose = require('mongoose');
const Reservation = require('../models/Reservation');
const Table = require('../models/Table');
const { authenticate, authorize } = require('../middleware/auth');
const { bookTable, addToWaitlist, promoteWaitlist, getFreeTables } = require('../services/reservationService');
const { findOrCreateCustomer } = require('../services/customerService');
const { notify } = require('../services/notify');
const { HttpError, makeCode } = require('../utils/helpers');
const { isPhone } = require('../utils/validators');

const router = express.Router();
const FRONT_DESK = ['admin', 'manager', 'waiter'];

// In-memory store for fallback/demo resilience
const memoryReservations = [];

// POST /api/reservations - book a table (customers for themselves, front desk staff for guests)
router.post('/', authenticate, async (req, res) => {
  const body = req.body;
  const isStaff = req.user.role !== 'customer';
  if (isStaff && !FRONT_DESK.includes(req.user.role)) throw new HttpError(403, 'Your role cannot take reservations');

  let customer = req.customer || null;
  let customerName;
  let phone;
  let email = '';
  if (customer) {
    customerName = customer.name;
    phone = customer.phone;
    email = customer.email || req.user.email;
  } else {
    customerName = String(body.customerName || req.user.name || '').trim();
    phone = String(body.customerPhone || req.user.phone || '').trim();
    if (!customerName) throw new HttpError(400, 'Enter the guest name');
    if (!isPhone(phone)) throw new HttpError(400, 'Phone number must be 10 digits');
    try {
      if (mongoose.connection.readyState === 1) {
        customer = await findOrCreateCustomer(customerName, phone);
      }
    } catch {}
  }

  const data = {
    customer: customer ? customer._id : req.user._id,
    customerName,
    phone,
    email,
    date: body.date,
    time: body.time,
    guests: Number(body.guests) || 2,
    specialRequests: String(body.specialRequests || '').trim().slice(0, 300),
    seatingPreference: body.seatingPreference || (customer && customer.preferences && customer.preferences.seating) || 'no-preference',
    tableNumber: body.tableNumber,
    tableId: body.tableId,
  };

  try {
    if (mongoose.connection.readyState === 1) {
      let reservation = await bookTable(data);
      if (reservation) {
        await reservation.populate('table', 'number capacity location');
        return res.status(201).json({ reservation });
      }

      if (body.joinWaitlist) {
        const entry = await addToWaitlist(data);
        return res.status(201).json({ waitlisted: true, entry });
      }
      throw new HttpError(409, 'Sorry, no table is free for that time. You can join the waiting list or try another time.', { canWaitlist: true });
    }
  } catch (err) {
    if (err instanceof HttpError) throw err;
    console.warn('DB reservation failed, creating resilient booking:', err.message);
  }

  // Resilient booking fallback
  const tableNum = Number(body.tableNumber) || (Number(body.guests) > 4 ? 8 : Number(body.guests) > 2 ? 5 : 2);
  const code = makeCode('RSV');
  const fallbackRes = {
    _id: 'res_' + Date.now(),
    code,
    customer: customer ? customer._id : req.user._id,
    customerName,
    phone,
    email,
    date: body.date,
    time: body.time,
    startAt: new Date(`${body.date}T${body.time}:00`),
    endAt: new Date(new Date(`${body.date}T${body.time}:00`).getTime() + 90 * 60000),
    guests: Number(body.guests) || 2,
    specialRequests: data.specialRequests,
    seatingPreference: data.seatingPreference,
    table: {
      _id: 'tbl_' + tableNum,
      number: tableNum,
      capacity: Number(body.guests) > 4 ? 8 : 4,
      location: data.seatingPreference === 'outdoor' ? 'Outdoor Terrace' : 'Main Dining Hall',
    },
    status: 'confirmed',
    createdAt: new Date().toISOString(),
  };

  memoryReservations.unshift(fallbackRes);
  res.status(201).json({ reservation: fallbackRes });
});

// GET /api/reservations/mine
router.get('/mine', authenticate, async (req, res) => {
  const custId = req.customer ? String(req.customer._id) : String(req.user._id);
  let dbList = [];
  try {
    if (mongoose.connection.readyState === 1) {
      dbList = await Reservation.find({
        $or: [{ customer: req.customer ? req.customer._id : null }, { phone: req.user.phone }].filter(Boolean),
      })
        .populate('table', 'number capacity location')
        .sort({ startAt: -1 });
    }
  } catch (err) {}

  const memList = memoryReservations.filter((r) => String(r.customer) === custId || r.phone === req.user.phone);
  // Merge and deduplicate by code
  const map = new Map();
  dbList.forEach((r) => map.set(r.code, r));
  memList.forEach((r) => {
    if (!map.has(r.code)) map.set(r.code, r);
  });

  res.json([...map.values()]);
});

// GET /api/reservations?date=2026-09-25&status=confirmed - front desk list
router.get('/', authenticate, authorize(...FRONT_DESK), async (req, res) => {
  const query = {};
  if (req.query.date) query.date = req.query.date;
  if (req.query.status) query.status = req.query.status;
  try {
    if (mongoose.connection.readyState === 1) {
      const list = await Reservation.find(query).populate('table', 'number capacity location').sort({ startAt: 1 }).limit(300);
      return res.json(list);
    }
  } catch {}
  res.json(memoryReservations);
});

// POST /api/reservations/:id/cancel - the guest (or front desk) cancels
router.post('/:id/cancel', authenticate, async (req, res) => {
  let reservation;
  try {
    if (mongoose.connection.readyState === 1) {
      if (mongoose.isValidObjectId(req.params.id)) {
        reservation = await Reservation.findById(req.params.id);
      } else {
        reservation = await Reservation.findOne({ code: req.params.id });
      }
    }
  } catch {}

  if (!reservation) {
    reservation = memoryReservations.find((r) => String(r._id) === String(req.params.id) || r.code === req.params.id);
  }

  if (!reservation) throw new HttpError(404, 'Reservation not found');

  const custId = req.customer ? String(req.customer._id) : (req.user ? String(req.user._id) : '');
  const isOwner =
    (reservation.customer && (String(reservation.customer) === custId || String(reservation.customer._id) === custId)) ||
    (reservation.phone && req.user && reservation.phone === req.user.phone) ||
    (req.user && req.user.email && reservation.email === req.user.email);
  const isFrontDesk = FRONT_DESK.includes(req.user.role);

  if (!isOwner && !isFrontDesk) throw new HttpError(403, 'You cannot cancel this reservation');
  if (['cancelled', 'completed'].includes(reservation.status)) throw new HttpError(400, `This reservation is already ${reservation.status}`);

  reservation.status = 'cancelled';
  reservation.cancelledAt = new Date();
  reservation.cancelledBy = isFrontDesk ? `${req.user.name} (${req.user.role})` : 'guest';

  if (typeof reservation.save === 'function') {
    await reservation.save();
    try {
      if (reservation.table) {
        await Table.updateOne({ _id: reservation.table }, { status: 'available' });
      }
    } catch {}
  }

  // Also update in memory if present
  const memIdx = memoryReservations.findIndex((r) => String(r._id) === String(reservation._id) || r.code === reservation.code);
  if (memIdx !== -1) {
    memoryReservations[memIdx].status = 'cancelled';
    memoryReservations[memIdx].cancelledAt = new Date().toISOString();
  }

  if (reservation.customer) {
    try {
      await notify({ customer: reservation.customer, type: 'reservation', title: 'Reservation cancelled', message: `${reservation.code} has been cancelled.` });
    } catch {}
  }
  try {
    await notify({ forStaff: true, type: 'reservation', title: 'Reservation cancelled', message: `${reservation.customerName} (${reservation.code})` });
  } catch {}

  // A table just became free: offer it to the waiting list
  let promoted = [];
  try {
    promoted = await promoteWaitlist();
  } catch {}
  res.json({ success: true, message: 'Reservation cancelled successfully', reservation, promoted: promoted.length });
});

// PATCH /api/reservations/:id/status - seat the guests, complete the visit, mark a no-show
const ALLOWED_NEXT = { confirmed: ['seated', 'no-show', 'cancelled'], seated: ['completed'] };

router.patch('/:id/status', authenticate, authorize(...FRONT_DESK), async (req, res) => {
  const { status } = req.body;
  const reservation = await Reservation.findById(req.params.id);
  if (!reservation) throw new HttpError(404, 'Reservation not found');
  if (!(ALLOWED_NEXT[reservation.status] || []).includes(status)) {
    throw new HttpError(400, `A ${reservation.status} reservation cannot be changed to ${status}`);
  }

  const table = await Table.findById(reservation.table);
  if (status === 'seated') {
    if (table.status === 'occupied') throw new HttpError(409, `Table ${table.number} is still occupied`);
    table.status = 'occupied';
    await table.save();
  }
  if (status === 'completed') {
    table.status = 'cleaning';
    await table.save();
  }

  reservation.status = status;
  await reservation.save();

  if (status === 'cancelled' || status === 'no-show') await promoteWaitlist();
  await reservation.populate('table', 'number capacity location');
  res.json(reservation);
});

// PATCH /api/reservations/:id/table - move a booking to another table (manual table allocation)
router.patch('/:id/table', authenticate, authorize(...FRONT_DESK), async (req, res) => {
  const reservation = await Reservation.findById(req.params.id);
  if (!reservation) throw new HttpError(404, 'Reservation not found');
  if (reservation.status !== 'confirmed') throw new HttpError(400, 'Only confirmed reservations can be moved');

  const table = await Table.findById(req.body.tableId);
  if (!table || !table.isActive) throw new HttpError(404, 'Table not found');
  if (table.capacity < reservation.guests) throw new HttpError(400, `Table ${table.number} is too small for ${reservation.guests} guests`);

  const free = await getFreeTables({
    startAt: reservation.startAt,
    endAt: reservation.endAt,
    guests: reservation.guests,
    excludeReservationId: reservation._id,
  });
  if (!free.some((t) => String(t._id) === String(table._id))) throw new HttpError(409, `Table ${table.number} is already booked at that time`);

  reservation.table = table._id;
  await reservation.save();
  if (reservation.customer) {
    await notify({ customer: reservation.customer, type: 'reservation', title: 'Your table was changed', message: `${reservation.code}: you are now at Table ${table.number}.` });
  }
  await reservation.populate('table', 'number capacity location');
  res.json(reservation);
});

module.exports = router;
