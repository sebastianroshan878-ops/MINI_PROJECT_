// Fills the database with demo data: staff, tables, menu, customers and two weeks of orders.
// Run with:  npm run seed      (WARNING: it clears the existing data first)
require('dotenv').config();
const connectDB = require('./config/db');
const mongoose = require('mongoose');

const User = require('./models/User');
const Customer = require('./models/Customer');
const Table = require('./models/Table');
const MenuItem = require('./models/MenuItem');
const Order = require('./models/Order');
const Payment = require('./models/Payment');
const Reservation = require('./models/Reservation');
const Waitlist = require('./models/Waitlist');
const Feedback = require('./models/Feedback');
const Notification = require('./models/Notification');
const Task = require('./models/Task');
const Attendance = require('./models/Attendance');

const { computeTotals } = require('./services/orderService');
const { getFreeTables } = require('./services/reservationService');
const { makeCode, toDateStr, toHHmm } = require('./utils/helpers');
const C = require('./config/constants');

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pickOne = (list) => list[rand(0, list.length - 1)];
const minutes = (n) => n * 60000;

// ---------------------------------------------------------------- static data
const STAFF = [
  { name: 'Admin', email: 'admin@restaurantpro.com', phone: '9000000000', password: 'admin123', role: 'admin' },
  { name: 'Meera Nair', email: 'manager@restaurantpro.com', phone: '9000000001', password: 'staff123', role: 'manager' },
  { name: 'Ravi Kumar', email: 'waiter@restaurantpro.com', phone: '9000000002', password: 'staff123', role: 'waiter' },
  { name: 'Sneha Pillai', email: 'waiter2@restaurantpro.com', phone: '9000000003', password: 'staff123', role: 'waiter' },
  { name: 'Arjun Menon', email: 'chef@restaurantpro.com', phone: '9000000004', password: 'staff123', role: 'chef' },
  { name: 'Kiran Das', email: 'delivery@restaurantpro.com', phone: '9000000005', password: 'staff123', role: 'delivery' },
  { name: 'Faisal Ali', email: 'delivery2@restaurantpro.com', phone: '9000000006', password: 'staff123', role: 'delivery' },
];

const TABLES = [
  [1, 2, 'window'], [2, 2, 'window'], [3, 2, 'indoor'], [4, 4, 'indoor'], [5, 4, 'indoor'],
  [6, 4, 'window'], [7, 4, 'outdoor'], [8, 6, 'indoor'], [9, 6, 'outdoor'], [10, 8, 'quiet-corner'],
];

const DEFAULT_MENU_ITEMS = require('./config/defaultMenu');
const MENU = DEFAULT_MENU_ITEMS.map((item) => {
  const clone = { ...item };
  delete clone._id;
  return clone;
});

const CUSTOMERS = [
  { name: 'Anjali Nair', phone: '9876500001', email: 'customer@demo.com', address: '24, Lake View Apartments, Green Park Road', account: true },
  { name: 'Rohit Sharma', phone: '9876500002', address: '8B, Sunrise Residency, Station Road' },
  { name: 'Fatima Zain', phone: '9876500003', address: '15, Palm Grove Layout, Temple Street' },
  { name: 'Vikram Rao', phone: '9876500004', address: '3rd Floor, Orchid Towers, Market Junction' },
  { name: 'Divya Menon', phone: '9876500005', address: '42, Rose Villa, Canal Road' },
  { name: 'Sanjay Patel', phone: '9876500006', address: '101, Maple Heights, College Road' },
  { name: 'Lakshmi Iyer', phone: '9876500007', address: '7, Jasmine Lane, Old Town' },
  { name: 'Thomas George', phone: '9876500008', address: '19, Harbour View, Beach Road' },
];

const GOOD_COMMENTS = [
  'The biryani was fantastic and arrived hot.', 'Lovely food and very quick service.', 'Best butter chicken in town!',
  'Great ambience and friendly staff.', 'Delivery was on time and the packing was neat.', 'Loved the paneer tikka, will order again.',
  'Perfect spice level, just as I asked.', 'Good portions for the price.',
];
const OK_COMMENTS = ['Food was good but the wait was a bit long.', 'Tasty, but the delivery was slightly late.', 'Decent experience overall.'];
const BAD_COMMENTS = ['Food arrived cold.', 'Order was delayed by almost an hour.'];

// ---------------------------------------------------------------- helpers
const usedCodes = new Set();
function uniqueCode(prefix) {
  let code = makeCode(prefix);
  while (usedCodes.has(code)) code = makeCode(prefix);
  usedCodes.add(code);
  return code;
}

function buildLines(menu) {
  const dishes = [...menu].sort(() => Math.random() - 0.5).slice(0, rand(1, 4));
  return dishes.map((dish) => {
    const addOns = dish.addOns.length && Math.random() < 0.3 ? [{ name: dish.addOns[0].name, price: dish.addOns[0].price }] : [];
    const quantity = rand(1, 3);
    const price = dish.price + addOns.reduce((s, a) => s + a.price, 0);
    return {
      menuItem: dish._id, name: dish.name, emoji: dish.emoji, category: dish.category, price, quantity, addOns,
      spiceLevel: dish.hasSpiceLevel ? pickOne(['mild', 'medium', 'hot']) : '', note: '', lineTotal: price * quantity,
    };
  });
}

function historyFor(type, status, createdAt, slowFinish) {
  const flow = C.ORDER_FLOW[type];
  const upTo = flow.slice(0, flow.indexOf(status) + 1);
  let time = createdAt.getTime();
  return upTo.map((s, i) => {
    if (i > 0) time += minutes(rand(3, 8)) + (slowFinish && i === upTo.length - 1 ? minutes(rand(15, 30)) : 0);
    return { status: s, at: new Date(time) };
  });
}

function paymentDetails(method) {
  if (method === 'card') return { cardBrand: pickOne(['Visa', 'Mastercard', 'RuPay']), cardLast4: String(rand(1000, 9999)) };
  if (method === 'upi') return { upiId: 'ab***@upi' };
  if (method === 'wallet') return { walletName: pickOne(['Paytm', 'PhonePe', 'Google Pay']) };
  return {};
}

// Creates one order (and its payment) for the demo data
async function makeOrder(menu, o) {
  const lines = buildLines(menu);
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const totals = computeTotals({ subtotal, type: o.type });
  const createdAt = o.createdAt;
  const cancelled = o.status === 'cancelled';
  const history = cancelled
    ? [{ status: 'placed', at: createdAt }, { status: 'cancelled', at: new Date(createdAt.getTime() + minutes(rand(2, 6))) }]
    : historyFor(o.type, o.status, createdAt, o.type === 'delivery' && Math.random() < 0.25);
  const completed = o.status === 'completed';

  const order = await Order.create({
    orderNumber: uniqueCode('ORD'),
    customer: o.customer ? o.customer._id : undefined,
    customerName: o.customer ? o.customer.name : 'Walk-in Guest',
    customerPhone: o.customer ? o.customer.phone : '',
    type: o.type,
    table: o.table ? o.table._id : undefined,
    items: lines,
    subtotal, discount: 0, gst: totals.gst, deliveryCharge: totals.deliveryCharge, total: totals.total,
    status: o.status,
    statusHistory: history,
    deliveryAddress: o.type === 'delivery' ? o.customer.address : '',
    expectedBy: new Date(createdAt.getTime() + minutes(C.EXPECTED_MINUTES[o.type])),
    completedAt: completed ? history[history.length - 1].at : undefined,
    assignedTo: o.assignedTo ? o.assignedTo._id : undefined,
    cancelReason: cancelled ? pickOne(['Changed my mind', 'Ordered by mistake', 'Taking too long']) : '',
    cancelledBy: cancelled ? 'customer' : '',
    createdAt,
  });

  if (o.paid) {
    const method = o.method || (o.type === 'dine-in' ? pickOne(['cash', 'card', 'upi']) : pickOne(['card', 'upi', 'wallet']));
    const refunded = !!o.refunded;
    const payment = await Payment.create({
      order: order._id, orderNumber: order.orderNumber, customer: order.customer, customerName: order.customerName,
      amount: order.total, method, status: refunded ? 'refunded' : 'success',
      transactionId: method === 'cash' ? uniqueCode('CASH') : `TXN${createdAt.getTime()}${rand(100, 999)}`,
      details: paymentDetails(method), paidAt: history[history.length - 1].at,
      refund: refunded ? { refundId: uniqueCode('RFD'), amount: order.total, reason: 'Food quality complaint', at: history[history.length - 1].at } : undefined,
      createdAt: history[history.length - 1].at,
    });
    order.payment = payment._id;
    order.paymentStatus = refunded ? 'refunded' : 'paid';
    if (!refunded) order.pointsEarned = order.customer ? Math.floor(order.total / C.POINTS_PER_RUPEES) : 0;
    await order.save();
  }
  return order;
}

async function makeFeedback(order, customer, rating, comment) {
  return Feedback.create({
    customer: customer._id, customerName: customer.name, order: order._id, orderNumber: order.orderNumber,
    type: 'order', rating, comment, createdAt: new Date(order.completedAt.getTime() + minutes(rand(20, 300))),
  });
}

// ---------------------------------------------------------------- main
async function seed() {
  const ok = await connectDB({ exitOnError: true, timeoutMs: 6000 });
  if (!ok) process.exit(1);
  console.log('Clearing old data...');
  await Promise.all([User, Customer, Table, MenuItem, Order, Payment, Reservation, Waitlist, Feedback, Notification, Task, Attendance].map((m) => m.deleteMany({})));

  console.log('Creating staff, tables and menu...');
  const staff = {};
  for (const s of STAFF) staff[s.email] = await User.create(s);
  const waiters = [staff['waiter@restaurantpro.com'], staff['waiter2@restaurantpro.com']];
  const deliveryBoys = [staff['delivery@restaurantpro.com'], staff['delivery2@restaurantpro.com']];

  const tables = [];
  for (const [number, capacity, location] of TABLES) tables.push(await Table.create({ number, capacity, location }));
  const menu = await MenuItem.insertMany(MENU);

  console.log('Creating customers...');
  const customers = [];
  for (const c of CUSTOMERS) {
    let user = null;
    if (c.account) user = await User.create({ name: c.name, email: c.email, phone: c.phone, password: 'customer123', role: 'customer' });
    customers.push(await Customer.create({
      user: user ? user._id : null, name: c.name, phone: c.phone, email: c.email || '', address: c.address,
      preferences: { seating: pickOne(['window', 'indoor', 'no-preference']), diet: 'any', spiceLevel: 'medium', orderType: 'delivery' },
    }));
  }
  const demo = customers[0];

  console.log('Creating two weeks of orders...');
  const now = new Date();
  const completedOrders = [];
  for (let daysAgo = 13; daysAgo >= 0; daysAgo--) {
    const count = rand(6, 10);
    for (let i = 0; i < count; i++) {
      let createdAt;
      if (daysAgo === 0) createdAt = new Date(now.getTime() - minutes(rand(90, 400)));
      else {
        createdAt = new Date(now.getTime() - daysAgo * 86400000);
        createdAt.setHours(rand(11, 21), rand(0, 59), 0, 0);
      }
      const type = pickOne(['dine-in', 'dine-in', 'dine-in', 'parcel', 'delivery', 'delivery', 'delivery']);
      const cancelled = Math.random() < 0.07;
      const customer = type === 'dine-in' ? (Math.random() < 0.5 ? pickOne(customers) : null) : pickOne(customers);
      const order = await makeOrder(menu, {
        type, createdAt, customer,
        status: cancelled ? 'cancelled' : 'completed',
        table: type === 'dine-in' ? pickOne(tables) : null,
        assignedTo: type === 'delivery' ? pickOne(deliveryBoys) : null,
        paid: !cancelled && !(type !== 'dine-in' && Math.random() < 0.05),
        refunded: !cancelled && Math.random() < 0.03,
      });
      if (order.status === 'completed' && order.customer) completedOrders.push({ order, customer });
    }
  }

  // Demo customer orders (so the demo login has history, tracking and feedback to try)
  const twoDaysAgo = new Date(now.getTime() - 2 * 86400000);
  const fiveDaysAgo = new Date(now.getTime() - 5 * 86400000);
  const demoDelivered = await makeOrder(menu, { type: 'delivery', createdAt: twoDaysAgo, customer: demo, status: 'completed', paid: true, method: 'card', assignedTo: deliveryBoys[0] });
  const demoParcel = await makeOrder(menu, { type: 'parcel', createdAt: fiveDaysAgo, customer: demo, status: 'completed', paid: true, method: 'upi' });
  await makeFeedback(demoParcel, demo, 5, 'Packed neatly and ready right on time.');
  const demoLive = await makeOrder(menu, { type: 'delivery', createdAt: new Date(now.getTime() - minutes(12)), customer: demo, status: 'preparing', paid: false, assignedTo: null });

  // Live orders happening "right now"
  await makeOrder(menu, { type: 'dine-in', createdAt: new Date(now.getTime() - minutes(25)), customer: null, status: 'preparing', table: tables[1] });
  await makeOrder(menu, { type: 'dine-in', createdAt: new Date(now.getTime() - minutes(4)), customer: null, status: 'placed', table: tables[3] });
  await makeOrder(menu, { type: 'parcel', createdAt: new Date(now.getTime() - minutes(18)), customer: customers[1], status: 'ready', paid: true, method: 'upi' });
  await makeOrder(menu, { type: 'delivery', createdAt: new Date(now.getTime() - minutes(30)), customer: customers[2], status: 'out-for-delivery', paid: false, assignedTo: deliveryBoys[0] });
  await makeOrder(menu, { type: 'delivery', createdAt: new Date(now.getTime() - minutes(2)), customer: customers[3], status: 'placed', paid: false });

  // Table board: two tables busy, one being cleaned
  await Table.updateOne({ _id: tables[1]._id }, { status: 'occupied' });
  await Table.updateOne({ _id: tables[3]._id }, { status: 'occupied' });
  await Table.updateOne({ _id: tables[5]._id }, { status: 'cleaning' });

  console.log('Creating feedback...');
  for (const { order, customer } of completedOrders) {
    if (order._id.equals(demoDelivered._id) || Math.random() > 0.55) continue;
    const roll = Math.random();
    if (roll < 0.7) await makeFeedback(order, customer, rand(4, 5), pickOne(GOOD_COMMENTS));
    else if (roll < 0.92) await makeFeedback(order, customer, 3, pickOne(OK_COMMENTS));
    else await makeFeedback(order, customer, rand(1, 2), pickOne(BAD_COMMENTS));
  }

  console.log('Creating reservations...');
  const statuses = ['completed', 'completed', 'completed', 'completed', 'completed', 'cancelled', 'no-show'];
  for (let daysAgo = 13; daysAgo >= 1; daysAgo--) {
    for (let i = 0; i < rand(3, 6); i++) {
      const startAt = new Date(now.getTime() - daysAgo * 86400000);
      startAt.setHours(rand(12, 21), pickOne([0, 30]), 0, 0);
      const guests = pickOne([2, 2, 3, 4, 4, 5, 6, 8]);
      const guest = pickOne(customers);
      const fit = tables.filter((t) => t.capacity >= guests);
      await Reservation.create({
        code: uniqueCode('RSV'), customer: guest._id, customerName: guest.name, phone: guest.phone, email: guest.email,
        date: toDateStr(startAt), time: toHHmm(startAt), startAt, endAt: new Date(startAt.getTime() + minutes(C.RESERVATION_MINUTES)),
        guests, table: pickOne(fit)._id, status: pickOne(statuses), createdAt: new Date(startAt.getTime() - 86400000),
      });
    }
  }

  // Upcoming reservations: use the same table-allocation code as the real app
  const upcoming = [];
  const inDays = (n, h, m) => {
    const d = new Date(now.getTime() + n * 86400000);
    d.setHours(h, m, 0, 0);
    return d;
  };
  if (now.getHours() < 19) upcoming.push([inDays(0, 20, 0), 2], [inDays(0, 20, 30), 4]);
  upcoming.push([inDays(1, 19, 30), 4, demo], [inDays(1, 19, 0), 2], [inDays(1, 20, 0), 6], [inDays(1, 20, 30), 3], [inDays(2, 13, 0), 5], [inDays(2, 20, 0), 8]);
  for (const [startAt, guests, who] of upcoming) {
    const guest = who || pickOne(customers.slice(1));
    const endAt = new Date(startAt.getTime() + minutes(C.RESERVATION_MINUTES));
    const [table] = await getFreeTables({ startAt, endAt, guests, seating: guest.preferences.seating });
    if (!table) continue;
    await Reservation.create({
      code: uniqueCode('RSV'), customer: guest._id, customerName: guest.name, phone: guest.phone, email: guest.email,
      date: toDateStr(startAt), time: toHHmm(startAt), startAt, endAt, guests, table: table._id,
      specialRequests: who ? 'Birthday celebration, please keep a small cake ready' : '',
      seatingPreference: guest.preferences.seating,
    });
  }
  // One waiting list entry: press "Check waiting list" in the admin panel to see it get a table
  const waitStart = inDays(1, 20, 0);
  await Waitlist.create({
    customer: customers[4]._id, customerName: customers[4].name, phone: customers[4].phone, date: toDateStr(waitStart),
    time: '20:00', startAt: waitStart, guests: 4, specialRequests: 'High chair for a toddler',
  });

  console.log('Creating loyalty points...');
  for (const customer of customers) {
    const paidOrders = await Order.find({ customer: customer._id, paymentStatus: 'paid' });
    const points = paidOrders.reduce((s, o) => s + o.pointsEarned, 0);
    customer.loyaltyPoints = points;
    customer.lifetimePoints = points;
    customer.totalSpent = paidOrders.reduce((s, o) => s + o.total, 0);
    await customer.save();
  }

  console.log('Creating tasks and attendance...');
  const manager = staff['manager@restaurantpro.com'];
  const taskList = [
    ['Wipe and reset the outdoor tables', waiters[0], 'high', 'done', 5],
    ['Restock napkins and cutlery', waiters[1], 'medium', 'done', 4],
    ['Prepare mise en place for dinner service', staff['chef@restaurantpro.com'], 'high', 'done', 5],
    ['Check the biryani stock for tonight', staff['chef@restaurantpro.com'], 'medium', 'in-progress'],
    ['Clean the delivery bikes and check helmets', deliveryBoys[0], 'low', 'pending'],
    ['Update the specials board', waiters[0], 'medium', 'pending'],
    ['Deliver the catering order to Green Park', deliveryBoys[1], 'high', 'done', 4],
  ];
  for (const [title, assignedTo, priority, status, rating] of taskList) {
    const dueAt = new Date(now.getTime() + minutes(rand(60, 600)) * (status === 'done' ? -1 : 1));
    await Task.create({
      title, assignedTo: assignedTo._id, assignedBy: manager._id, priority, status, dueAt,
      completedAt: status === 'done' ? new Date(dueAt.getTime() - minutes(rand(10, 90))) : undefined, rating,
    });
  }
  for (const member of Object.values(staff)) {
    for (let daysAgo = 10; daysAgo >= 1; daysAgo--) {
      if (Math.random() < 0.15) continue;
      const checkIn = new Date(now.getTime() - daysAgo * 86400000);
      checkIn.setHours(10, rand(0, 40), 0, 0);
      const checkOut = new Date(checkIn.getTime() + minutes(rand(7, 9) * 60));
      await Attendance.create({ user: member._id, date: toDateStr(checkIn), checkIn, checkOut });
    }
  }
  for (const member of [waiters[0], staff['chef@restaurantpro.com']]) {
    await Attendance.create({ user: member._id, date: toDateStr(now), checkIn: new Date(now.getTime() - minutes(rand(60, 180))) });
  }

  await Notification.create({ customer: demo._id, type: 'info', title: 'Welcome to RestaurantPro', message: 'Reserve a table, order online and earn loyalty points on every bill.' });

  console.log('\nDone! Demo logins:');
  console.log('  Admin     admin@restaurantpro.com     / admin123');
  console.log('  Manager   manager@restaurantpro.com   / staff123');
  console.log('  Waiter    waiter@restaurantpro.com    / staff123');
  console.log('  Chef      chef@restaurantpro.com      / staff123');
  console.log('  Delivery  delivery@restaurantpro.com  / staff123');
  console.log('  Customer  customer@demo.com           / customer123');
  console.log(`  (demo customer's live order: ${demoLive.orderNumber}, phone ${demo.phone} - try the Track Order page)`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
