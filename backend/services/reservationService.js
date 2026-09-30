const Table = require('../models/Table');
const Reservation = require('../models/Reservation');
const Waitlist = require('../models/Waitlist');
const { notify } = require('./notify');
const { HttpError, makeCode, buildDate } = require('../utils/helpers');
const { isDate, isTime } = require('../utils/validators');
const C = require('../config/constants');

const niceSlot = (d) =>
  d.toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

// Check the date, time and guest count. Returns the start and end time of the booking.
async function validateSlot(date, time, guests) {
  if (!isDate(date) || !isTime(time)) throw new HttpError(400, 'Choose a valid date and time');
  const count = Number(guests);
  if (!Number.isInteger(count) || count < 1) throw new HttpError(400, 'Guest count must be at least 1');
  if (time < C.OPEN_TIME || time > C.LAST_RESERVATION_TIME) {
    throw new HttpError(400, `We take reservations between ${C.OPEN_TIME} and ${C.LAST_RESERVATION_TIME}`);
  }

  const startAt = buildDate(date, time);
  if (isNaN(startAt.getTime())) throw new HttpError(400, 'Choose a valid date and time');
  if (startAt <= new Date()) throw new HttpError(400, 'Please choose a time in the future');
  if (startAt.getTime() - Date.now() > 60 * 24 * 3600 * 1000) throw new HttpError(400, 'You can book up to 60 days ahead');

  const biggest = await Table.findOne({ isActive: true }).sort({ capacity: -1 });
  if (!biggest) throw new HttpError(400, 'No tables have been set up yet');
  if (count > biggest.capacity) {
    throw new HttpError(400, `Our largest table seats ${biggest.capacity}. Please call us for bigger groups`);
  }
  return { startAt, endAt: new Date(startAt.getTime() + C.RESERVATION_MINUTES * 60000), guests: count };
}

// TABLE ALLOCATION + OPTIMIZATION
// 1. keep only tables that seat enough guests
// 2. remove tables already booked at an overlapping time
// 3. sort so the best table comes first: preferred seating area, then the SMALLEST table that fits
//    (this keeps big tables free for big groups)
async function getFreeTables({ startAt, endAt, guests = 1, seating = null, excludeReservationId = null }) {
  const tables = await Table.find({ isActive: true, capacity: { $gte: guests } });

  const clashQuery = { status: { $in: ['confirmed', 'seated'] }, startAt: { $lt: endAt }, endAt: { $gt: startAt } };
  if (excludeReservationId) clashQuery._id = { $ne: excludeReservationId };
  const busy = await Reservation.find(clashQuery).select('table');
  const busyIds = new Set(busy.map((r) => String(r.table)));

  const free = tables.filter((t) => !busyIds.has(String(t._id)));
  const wantsArea = seating && seating !== 'no-preference';
  free.sort((a, b) => {
    const scoreA = wantsArea && a.location === seating ? 0 : 1;
    const scoreB = wantsArea && b.location === seating ? 0 : 1;
    return scoreA - scoreB || a.capacity - b.capacity || a.number - b.number;
  });
  return free;
}

async function notifyReservation(reservation, table) {
  const when = niceSlot(reservation.startAt);
  if (reservation.customer) {
    await notify({
      customer: reservation.customer,
      type: 'reservation',
      title: reservation.fromWaitlist ? 'A table opened up for you' : 'Reservation confirmed',
      message: `${reservation.code}: Table ${table.number} for ${reservation.guests} guests on ${when}. Please arrive 10 minutes early.`,
    });
  }
  await notify({
    forStaff: true,
    type: 'reservation',
    title: 'New reservation',
    message: `${reservation.customerName}, ${reservation.guests} guests, Table ${table.number}, ${when}`,
  });
  console.log(`[SIMULATED EMAIL/SMS to ${reservation.email || reservation.phone}] Reservation ${reservation.code} confirmed for ${when}, Table ${table.number}`);
}

// Try to book. Returns the reservation, or null when no table is free.
async function bookTable(data) {
  const { startAt, endAt, guests } = await validateSlot(data.date, data.time, data.guests);

  if (data.customer) {
    const clash = await Reservation.findOne({
      customer: data.customer,
      status: { $in: ['confirmed', 'seated'] },
      startAt: { $lt: endAt },
      endAt: { $gt: startAt },
    });
    if (clash) throw new HttpError(409, `You already have a reservation (${clash.code}) around that time`);
  }

  const [table] = await getFreeTables({ startAt, endAt, guests, seating: data.seatingPreference });
  if (!table) return null;

  const reservation = await Reservation.create({
    code: makeCode('RSV'),
    customer: data.customer,
    customerName: data.customerName,
    phone: data.phone,
    email: data.email || '',
    date: data.date,
    time: data.time,
    startAt,
    endAt,
    guests,
    specialRequests: data.specialRequests || '',
    seatingPreference: data.seatingPreference || 'no-preference',
    table: table._id,
    fromWaitlist: !!data.fromWaitlist,
  });
  await notifyReservation(reservation, table);
  return reservation;
}

// WAITING LIST: used when every suitable table is booked
async function addToWaitlist(data) {
  const { startAt, guests } = await validateSlot(data.date, data.time, data.guests);

  const already = await Waitlist.findOne({ phone: data.phone, date: data.date, time: data.time, status: 'waiting' });
  if (already) throw new HttpError(409, 'You are already on the waiting list for that time');

  const entry = await Waitlist.create({
    customer: data.customer,
    customerName: data.customerName,
    phone: data.phone,
    email: data.email || '',
    date: data.date,
    time: data.time,
    startAt,
    guests,
    specialRequests: data.specialRequests || '',
    seatingPreference: data.seatingPreference || 'no-preference',
  });

  if (data.customer) {
    await notify({
      customer: data.customer,
      type: 'reservation',
      title: 'You are on the waiting list',
      message: `We will confirm a table for ${guests} guests on ${niceSlot(startAt)} as soon as one is free.`,
    });
  }
  await notify({ forStaff: true, type: 'reservation', title: 'New waiting list entry', message: `${data.customerName}, ${guests} guests, ${niceSlot(startAt)}` });
  return entry;
}

// Go through the waiting list (oldest first) and give tables to whoever can now be seated.
async function promoteWaitlist() {
  const entries = await Waitlist.find({ status: 'waiting' }).sort({ createdAt: 1 });
  const promoted = [];

  for (const entry of entries) {
    if (entry.startAt <= new Date()) {
      entry.status = 'cancelled'; // that time has already passed
      await entry.save();
      continue;
    }
    try {
      const reservation = await bookTable({
        customer: entry.customer,
        customerName: entry.customerName,
        phone: entry.phone,
        email: entry.email,
        date: entry.date,
        time: entry.time,
        guests: entry.guests,
        specialRequests: entry.specialRequests,
        seatingPreference: entry.seatingPreference,
        fromWaitlist: true,
      });
      if (reservation) {
        entry.status = 'promoted';
        entry.reservation = reservation._id;
        await entry.save();
        promoted.push(reservation);
      }
    } catch (err) {
      // e.g. the guest already booked another table for that time - just skip this entry
    }
  }
  return promoted;
}

module.exports = { validateSlot, getFreeTables, bookTable, addToWaitlist, promoteWaitlist, niceSlot };
