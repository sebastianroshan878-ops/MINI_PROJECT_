const express = require('express');
const Order = require('../models/Order');
const Reservation = require('../models/Reservation');
const Feedback = require('../models/Feedback');
const Table = require('../models/Table');
const MenuItem = require('../models/MenuItem');
const Customer = require('../models/Customer');
const Waitlist = require('../models/Waitlist');
const { authenticate, authorize } = require('../middleware/auth');
const { round2, toDateStr, startOfDay, endOfDay, minutesBetween } = require('../utils/helpers');

const router = express.Router();

const sum = (list) => list.reduce((total, n) => total + n, 0);
const average = (list) => (list.length ? sum(list) / list.length : 0);

// GET /api/analytics?days=7
// Everything on the dashboard. We load the last N days of data and add it up with plain JavaScript,
// which is easy to read and to explain.
router.get('/', authenticate, authorize('admin', 'manager'), async (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 1), 90);
  const now = new Date();
  const since = startOfDay(new Date(Date.now() - (days - 1) * 86400000));

  const [orders, reservations, feedback, tables, menuItems, newCustomers, waitingNow] = await Promise.all([
    Order.find({ createdAt: { $gte: since } }),
    Reservation.find({ startAt: { $gte: since, $lte: endOfDay(now) } }),
    Feedback.find({ createdAt: { $gte: since } }),
    Table.find({ isActive: true }).sort({ number: 1 }),
    MenuItem.find(),
    Customer.countDocuments({ createdAt: { $gte: since } }),
    Waitlist.countDocuments({ status: 'waiting' }),
  ]);

  const dayKeys = [];
  for (let i = days - 1; i >= 0; i--) dayKeys.push(toDateStr(new Date(Date.now() - i * 86400000)));

  const liveOrders = orders.filter((o) => o.status !== 'cancelled');
  const paid = orders.filter((o) => o.paymentStatus === 'paid');

  // 1. Revenue by service type (dining, parcel, delivery) and by day
  const revenue = round2(sum(paid.map((o) => o.total)));
  const revenueByType = ['dine-in', 'parcel', 'delivery'].map((type) => {
    const list = paid.filter((o) => o.type === type);
    return { type, revenue: round2(sum(list.map((o) => o.total))), orders: list.length };
  });
  const revenueByDay = dayKeys.map((date) => ({
    date,
    revenue: round2(sum(paid.filter((o) => toDateStr(o.createdAt) === date).map((o) => o.total))),
  }));

  // 2. Reservation trends
  const activeReservations = reservations.filter((r) => r.status !== 'cancelled');
  const reservationsByDay = dayKeys.map((date) => ({
    date,
    count: activeReservations.filter((r) => r.date === date).length,
  }));
  const reservationsByHour = [];
  for (let hour = 11; hour <= 21; hour++) {
    reservationsByHour.push({
      hour: `${hour}:00`,
      count: activeReservations.filter((r) => parseInt(r.time.slice(0, 2), 10) === hour).length,
    });
  }
  const noShows = reservations.filter((r) => r.status === 'no-show').length;
  const cancelledReservations = reservations.filter((r) => r.status === 'cancelled').length;

  // 3. Table turnover = how many parties used each table (reservations seated + walk-in dine-in orders)
  const tableUsage = tables.map((table) => {
    const fromReservations = reservations.filter(
      (r) => String(r.table) === String(table._id) && ['seated', 'completed'].includes(r.status)
    ).length;
    const walkIns = liveOrders.filter(
      (o) => o.type === 'dine-in' && String(o.table) === String(table._id) && !o.reservation
    ).length;
    return { table: table.number, capacity: table.capacity, turns: fromReservations + walkIns };
  });
  const totalTurns = sum(tableUsage.map((t) => t.turns));
  const turnoverRate = tables.length ? round2(totalTurns / tables.length / days) : 0; // parties per table per day

  // 4. Popular dishes and menu analysis
  const sales = {};
  liveOrders.forEach((order) => {
    order.items.forEach((item) => {
      const key = String(item.menuItem);
      if (!sales[key]) sales[key] = { name: item.name, category: item.category, quantity: 0, revenue: 0 };
      sales[key].quantity += item.quantity;
      sales[key].revenue = round2(sales[key].revenue + item.lineTotal);
    });
  });
  const popularDishes = Object.values(sales).sort((a, b) => b.quantity - a.quantity).slice(0, 8);
  const leastOrdered = menuItems
    .map((m) => ({ name: m.name, category: m.category, quantity: sales[String(m._id)] ? sales[String(m._id)].quantity : 0 }))
    .sort((a, b) => a.quantity - b.quantity)
    .slice(0, 5);
  const categorySales = {};
  Object.values(sales).forEach((s) => {
    if (!categorySales[s.category]) categorySales[s.category] = { category: s.category, quantity: 0, revenue: 0 };
    categorySales[s.category].quantity += s.quantity;
    categorySales[s.category].revenue = round2(categorySales[s.category].revenue + s.revenue);
  });

  // 5. Customer satisfaction
  const ratings = feedback.map((f) => f.rating);
  const distribution = [5, 4, 3, 2, 1].map((stars) => ({ stars, count: ratings.filter((r) => r === stars).length }));
  const satisfaction = {
    average: round2(average(ratings)),
    total: ratings.length,
    satisfiedPercent: ratings.length ? Math.round((ratings.filter((r) => r >= 4).length / ratings.length) * 100) : 0,
    distribution,
  };

  // 6. Delivery performance
  const deliveries = orders.filter((o) => o.type === 'delivery');
  const delivered = deliveries.filter((o) => o.status === 'completed' && o.completedAt);
  const onTime = delivered.filter((o) => o.expectedBy && o.completedAt <= new Date(o.expectedBy.getTime() + 5 * 60000));
  const delivery = {
    total: deliveries.length,
    delivered: delivered.length,
    cancelled: deliveries.filter((o) => o.status === 'cancelled').length,
    active: deliveries.filter((o) => !['completed', 'cancelled'].includes(o.status)).length,
    avgMinutes: Math.round(average(delivered.map((o) => minutesBetween(o.createdAt, o.completedAt)))),
    onTimePercent: delivered.length ? Math.round((onTime.length / delivered.length) * 100) : 0,
  };

  res.json({
    days,
    summary: {
      revenue,
      orders: liveOrders.length,
      cancelledOrders: orders.length - liveOrders.length,
      avgOrderValue: paid.length ? round2(revenue / paid.length) : 0,
      reservations: activeReservations.length,
      newCustomers,
      waitingNow,
      avgRating: satisfaction.average,
    },
    revenueByType,
    revenueByDay,
    reservations: { byDay: reservationsByDay, byHour: reservationsByHour, noShows, cancelled: cancelledReservations },
    tableTurnover: { rate: turnoverRate, totalTurns, tables: tableUsage },
    menu: { popularDishes, leastOrdered, categorySales: Object.values(categorySales).sort((a, b) => b.revenue - a.revenue) },
    satisfaction,
    delivery,
  });
});

module.exports = router;
