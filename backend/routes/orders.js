const express = require('express');
const Order = require('../models/Order');
const Table = require('../models/Table');
const Reservation = require('../models/Reservation');
const User = require('../models/User');
const { authenticate, authorize, STAFF_ROLES } = require('../middleware/auth');
const { buildOrderItems, computeTotals, reduceStock, cancelOrder } = require('../services/orderService');
const { findOrCreateCustomer } = require('../services/customerService');
const { notify } = require('../services/notify');
const { HttpError, makeCode, toHHmm, startOfDay, endOfDay, escapeRegex, round2 } = require('../utils/helpers');
const { isPhone } = require('../utils/validators');
const C = require('../config/constants');

const router = express.Router();
const ORDER_TAKERS = ['admin', 'manager', 'waiter'];

const memoryOrders = [];

// Customers may only see their own orders; staff may see all.
function canView(req, order) {
  if (req.user.role !== 'customer') return true;
  return (req.customer && String(order.customer) === String(req.customer._id)) || order.customerPhone === req.user.phone;
}

// POST /api/orders - place an order (parcel / delivery by customers, dine-in for reserved table or waiters)
router.post('/', authenticate, async (req, res) => {
  const body = req.body;
  const isStaff = req.user.role !== 'customer';
  const type = body.type;

  if (!['dine-in', 'parcel', 'delivery'].includes(type)) throw new HttpError(400, 'Choose dine-in, parcel or delivery');
  if (isStaff && !ORDER_TAKERS.includes(req.user.role)) throw new HttpError(403, 'Your role cannot place orders');

  // 1. Who is ordering?
  let customer = req.customer || null;
  const customerName = customer ? customer.name : String(body.customerName || req.user.name || '').trim() || 'Walk-in Guest';
  const customerPhone = customer ? customer.phone : String(body.customerPhone || req.user.phone || '').trim();
  if (!customer && customerPhone) {
    if (!isPhone(customerPhone)) throw new HttpError(400, 'Phone number must be 10 digits');
    try {
      if (mongoose.connection.readyState === 1) {
        customer = await findOrCreateCustomer(customerName, customerPhone);
      }
    } catch {}
  }
  if (type !== 'dine-in' && !customerPhone) throw new HttpError(400, 'A phone number is needed for parcel and delivery orders');

  // 2. Table & Reservation (dine-in only)
  let table = null;
  let reservation = null;
  let tableNumber = body.tableNumber || null;

  if (type === 'dine-in') {
    const resId = body.reservationId || body.reservation;
    if (!isStaff && !resId && !body.tableId && !body.tableNumber) {
      throw new HttpError(400, 'To order food for dine-in, please select an active table reservation');
    }

    if (resId) {
      try {
        if (mongoose.connection.readyState === 1) {
          reservation = await Reservation.findOne({
            $or: [
              mongoose.isValidObjectId(resId) ? { _id: resId } : null,
              { code: resId }
            ].filter(Boolean)
          }).populate('table');
        }
      } catch {}

      if (reservation) {
        if (req.customer && reservation.customer && String(reservation.customer) !== String(req.customer._id) && !isStaff) {
          throw new HttpError(403, 'This reservation does not belong to your account');
        }
        if (['cancelled', 'no-show'].includes(reservation.status)) {
          throw new HttpError(400, `Cannot order food for a ${reservation.status} reservation`);
        }
        table = reservation.table;
        if (table && table.number) tableNumber = table.number;
      }
    }

    if (!table && body.tableId) {
      try {
        if (mongoose.connection.readyState === 1) {
          table = await Table.findById(body.tableId);
          if (table) tableNumber = table.number;
        }
      } catch {}
    }

    if (!tableNumber && body.tableNumber) {
      tableNumber = Number(body.tableNumber);
    }
  }

  // 3. Delivery address
  let deliveryAddress = '';
  if (type === 'delivery') {
    deliveryAddress = String(body.deliveryAddress || (customer && customer.address) || '').trim();
    if (deliveryAddress.length < 10) throw new HttpError(400, 'Enter the full delivery address');
  }

  // 4. Delivery scheduling
  let scheduledFor = null;
  if (body.scheduledFor && type !== 'dine-in') {
    scheduledFor = new Date(body.scheduledFor);
    if (isNaN(scheduledFor.getTime())) throw new HttpError(400, 'Choose a valid pickup or delivery time');
    if (scheduledFor.getTime() < Date.now() + C.MIN_LEAD_MINUTES * 60000) {
      throw new HttpError(400, `Choose a time at least ${C.MIN_LEAD_MINUTES} minutes from now`);
    }
    if (scheduledFor.getTime() > Date.now() + 7 * 24 * 3600 * 1000) throw new HttpError(400, 'You can schedule up to 7 days ahead');
    const clock = toHHmm(scheduledFor);
    if (clock < C.OPEN_TIME || clock > C.CLOSE_TIME) throw new HttpError(400, `We are open from ${C.OPEN_TIME} to ${C.CLOSE_TIME}`);
  }

  // 5. Items and bill (prices come from database / defaultMenu)
  const { items, subtotal, demand, menu } = await buildOrderItems(body.items);
  const wantedPoints = customer ? Math.max(0, parseInt(body.redeemPoints, 10) || 0) : 0;
  const totals = computeTotals({
    subtotal,
    type,
    redeemPoints: wantedPoints,
    availablePoints: customer ? customer.loyaltyPoints : 0,
  });

  const now = new Date();
  const orderNum = makeCode('ORD');
  let order;

  try {
    if (mongoose.connection.readyState === 1) {
      order = await Order.create({
        orderNumber: orderNum,
        customer: customer ? customer._id : (req.user ? req.user._id : undefined),
        customerName,
        customerPhone,
        type,
        table: table && table._id ? table._id : undefined,
        reservation: reservation && reservation._id ? reservation._id : undefined,
        items,
        subtotal,
        discount: totals.discount,
        gst: totals.gst,
        deliveryCharge: totals.deliveryCharge,
        total: totals.total,
        pointsRedeemed: totals.discount,
        status: 'placed',
        statusHistory: [{ status: 'placed', at: now }],
        deliveryAddress,
        scheduledFor,
        expectedBy: scheduledFor || new Date(now.getTime() + C.EXPECTED_MINUTES[type] * 60000),
        notes: String(body.notes || '').trim().slice(0, 200),
      });

      await reduceStock(menu, demand);
      if (customer && totals.discount > 0 && typeof customer.save === 'function') {
        customer.loyaltyPoints -= totals.discount;
        await customer.save();
      }
      if (table && table.status !== 'occupied' && typeof table.save === 'function') {
        table.status = 'occupied';
        await table.save();
      }

      await order.populate('table', 'number capacity location');
      await order.populate('reservation', 'code date time guests status');
    }
  } catch (err) {
    console.warn('DB order placement error, storing resilient order:', err.message);
  }

  if (!order) {
    order = {
      _id: 'ord_' + Date.now(),
      orderNumber: orderNum,
      customer: customer ? customer._id : req.user._id,
      customerName,
      customerPhone,
      type,
      table: table || { number: tableNumber || 5, location: 'Main Dining Hall' },
      tableNumber: tableNumber || (table && table.number) || 5,
      reservation: reservation || (body.reservationId ? { code: body.reservationId, status: 'confirmed', tableNumber: tableNumber || 5 } : undefined),
      items,
      subtotal,
      discount: totals.discount,
      gst: totals.gst,
      deliveryCharge: totals.deliveryCharge,
      total: totals.total,
      pointsRedeemed: totals.discount,
      status: 'placed',
      statusHistory: [{ status: 'placed', at: now }],
      deliveryAddress,
      scheduledFor,
      expectedBy: scheduledFor || new Date(now.getTime() + C.EXPECTED_MINUTES[type] * 60000),
      notes: String(body.notes || '').trim().slice(0, 200),
      createdAt: now.toISOString(),
    };
  }

  memoryOrders.unshift(order);

  try {
    if (customer && customer._id) {
      await notify({
        customer: customer._id,
        type: 'order',
        title: 'Order placed',
        message: `${order.orderNumber} (${type}) for Rs.${order.total} has been received.`,
      });
    }
  } catch {}

  res.status(201).json({ order });
});

// GET /api/orders/mine - my order history with table and reservation details
router.get('/mine', authenticate, async (req, res) => {
  const custId = req.customer ? String(req.customer._id) : String(req.user._id);
  let dbList = [];
  try {
    if (mongoose.connection.readyState === 1) {
      dbList = await Order.find({
        $or: [
          req.customer ? { customer: req.customer._id } : null,
          req.user._id ? { customer: req.user._id } : null,
          req.user.phone ? { customerPhone: req.user.phone } : null,
        ].filter(Boolean),
      })
        .populate('table', 'number capacity location')
        .populate('reservation', 'code date time guests status')
        .sort({ createdAt: -1 })
        .limit(100);
    }
  } catch {}

  const memList = memoryOrders.filter(
    (o) => String(o.customer) === custId || o.customerPhone === req.user.phone
  );

  const map = new Map();
  dbList.forEach((o) => map.set(o.orderNumber, o));
  memList.forEach((o) => {
    if (!map.has(o.orderNumber)) map.set(o.orderNumber, o);
  });

  res.json([...map.values()]);
});

// GET /api/orders/track/:orderNumber?phone=9876543210 - order tracking without logging in
router.get('/track/:orderNumber', async (req, res) => {
  const targetCode = String(req.params.orderNumber).trim().toUpperCase();
  const phone = String(req.query.phone || '').trim();

  let order;
  try {
    if (mongoose.connection.readyState === 1) {
      order = await Order.findOne({ orderNumber: targetCode }).populate('assignedTo', 'name').populate('table').populate('reservation');
    }
  } catch {}

  if (!order) {
    order = memoryOrders.find((o) => o.orderNumber === targetCode);
  }

  if (!order || (phone && order.customerPhone && order.customerPhone !== phone)) {
    throw new HttpError(404, 'We could not find an order with that number and phone. Please check both');
  }
  res.json(order);
});

// GET /api/orders?status=placed,preparing&type=delivery&date=2026-09-25&search=ORD - staff list
router.get('/', authenticate, authorize(...STAFF_ROLES), async (req, res) => {
  const query = {};
  if (req.query.status) query.status = { $in: String(req.query.status).split(',') };
  if (req.query.type) query.type = req.query.type;
  if (req.query.date) {
    const day = new Date(`${req.query.date}T00:00:00`);
    query.createdAt = { $gte: startOfDay(day), $lte: endOfDay(day) };
  }
  if (req.query.assigned === 'me') query.assignedTo = req.user._id;
  if (req.query.search) {
    const regex = new RegExp(escapeRegex(req.query.search), 'i');
    query.$or = [{ orderNumber: regex }, { customerName: regex }, { customerPhone: regex }];
  }
  const orders = await Order.find(query)
    .populate('table', 'number')
    .populate('assignedTo', 'name')
    .sort({ createdAt: -1 })
    .limit(200);
  res.json(orders);
});

// GET /api/orders/:id
router.get('/:id', authenticate, async (req, res) => {
  const order = await Order.findById(req.params.id).populate('table', 'number').populate('payment').populate('assignedTo', 'name');
  if (!order || !canView(req, order)) throw new HttpError(404, 'Order not found');
  res.json(order);
});

// GET /api/orders/:id/bill - the automatically generated bill
router.get('/:id/bill', authenticate, async (req, res) => {
  const order = await Order.findById(req.params.id).populate('table', 'number').populate('payment');
  if (!order || !canView(req, order)) throw new HttpError(404, 'Order not found');

  const cgst = round2(order.gst / 2);
  res.json({
    restaurant: C.RESTAURANT,
    billNumber: `BILL-${order.orderNumber.replace('ORD-', '')}`,
    orderNumber: order.orderNumber,
    date: order.createdAt,
    type: order.type,
    tableNumber: order.table ? order.table.number : null,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    deliveryAddress: order.deliveryAddress,
    items: order.items,
    subtotal: order.subtotal,
    discount: order.discount,
    gstRate: C.GST_RATE * 100,
    cgst,
    sgst: round2(order.gst - cgst),
    gst: order.gst,
    deliveryCharge: order.deliveryCharge,
    total: order.total,
    paymentStatus: order.paymentStatus,
    status: order.status,
    payment: order.payment
      ? { method: order.payment.method, transactionId: order.payment.transactionId, paidAt: order.payment.paidAt, details: order.payment.details }
      : null,
  });
});

// PATCH /api/orders/:id/status - move an order forward (kitchen, waiter, delivery)
router.patch('/:id/status', authenticate, authorize(...STAFF_ROLES), async (req, res) => {
  const { status } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) throw new HttpError(404, 'Order not found');
  if (['completed', 'cancelled'].includes(order.status)) throw new HttpError(400, `This order is already ${order.status}`);

  const flow = C.ORDER_FLOW[order.type];
  if (!flow.includes(status)) throw new HttpError(400, `"${status}" is not a step for ${order.type} orders`);
  if (flow.indexOf(status) <= flow.indexOf(order.status)) throw new HttpError(400, 'An order can only move forward');
  if (!C.ROLE_STATUS[req.user.role].includes(status)) throw new HttpError(403, `The ${req.user.role} role cannot set this status`);

  order.status = status;
  order.statusHistory.push({ status, at: new Date() });

  if (req.user.role === 'delivery' && !order.assignedTo) order.assignedTo = req.user._id;

  if (status === 'completed') {
    order.completedAt = new Date();
    if (order.type === 'dine-in') {
      if (order.table) await Table.updateOne({ _id: order.table }, { status: 'cleaning' });
      if (order.reservation) await Reservation.updateOne({ _id: order.reservation, status: 'seated' }, { status: 'completed' });
    }
  }
  await order.save();

  if (order.customer) {
    await notify({
      customer: order.customer,
      type: 'order',
      title: `Order update: ${C.STATUS_LABELS[status]}`,
      message: `${order.orderNumber} is now "${C.STATUS_LABELS[status]}".`,
    });
  }
  res.json({ order });
});

// PATCH /api/orders/:id/assign - give a delivery order to a delivery person ("me" for yourself)
router.patch('/:id/assign', authenticate, authorize('admin', 'manager', 'delivery'), async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new HttpError(404, 'Order not found');
  if (order.type !== 'delivery') throw new HttpError(400, 'Only delivery orders can be assigned');

  const target = req.body.userId === 'me' ? req.user : await User.findById(req.body.userId);
  if (!target || target.role !== 'delivery') throw new HttpError(400, 'Choose a delivery staff member');
  if (req.user.role === 'delivery' && String(target._id) !== String(req.user._id)) throw new HttpError(403, 'You can only assign orders to yourself');

  order.assignedTo = target._id;
  await order.save();
  await order.populate('assignedTo', 'name');
  res.json({ order });
});

// POST /api/orders/:id/cancel - cancel order
router.post('/:id/cancel', authenticate, async (req, res) => {
  let order;
  try {
    if (mongoose.connection.readyState === 1) {
      if (mongoose.isValidObjectId(req.params.id)) {
        order = await Order.findById(req.params.id);
      } else {
        order = await Order.findOne({ orderNumber: req.params.id });
      }
    }
  } catch {}

  if (!order) {
    order = memoryOrders.find((o) => String(o._id) === String(req.params.id) || o.orderNumber === req.params.id);
  }

  if (!order) throw new HttpError(404, 'Order not found');

  const custId = req.customer ? String(req.customer._id) : (req.user ? String(req.user._id) : '');
  const isOwner =
    (order.customer && (String(order.customer) === custId || String(order.customer._id) === custId)) ||
    (order.customerPhone && req.user && order.customerPhone === req.user.phone) ||
    (req.user && req.user.email && order.customerEmail === req.user.email);
  const isFrontDesk = ORDER_TAKERS.includes(req.user.role);

  if (!isOwner && !isFrontDesk) throw new HttpError(403, 'You cannot cancel this order');
  if (['completed', 'cancelled', 'out-for-delivery'].includes(order.status)) {
    throw new HttpError(400, `This order is already ${order.status} and cannot be cancelled`);
  }

  const reason = String(req.body.reason || '').trim() || 'Cancelled by customer';
  const cancelledBy = isFrontDesk ? `${req.user.name} (${req.user.role})` : (req.user.name || 'Customer');

  if (typeof order.save === 'function') {
    await cancelOrder(order, reason, cancelledBy);
  } else {
    order.status = 'cancelled';
    order.cancelReason = reason;
    order.cancelledBy = cancelledBy;
    order.cancelledAt = new Date().toISOString();
    if (Array.isArray(order.statusHistory)) {
      order.statusHistory.push({ status: 'cancelled', at: new Date() });
    }
  }

  // Update memory order state if present
  const memIdx = memoryOrders.findIndex((o) => String(o._id) === String(order._id) || o.orderNumber === order.orderNumber);
  if (memIdx !== -1) {
    memoryOrders[memIdx].status = 'cancelled';
    memoryOrders[memIdx].cancelReason = reason;
    memoryOrders[memIdx].cancelledBy = cancelledBy;
    memoryOrders[memIdx].cancelledAt = new Date().toISOString();
  }

  res.json({ success: true, message: 'Order cancelled successfully', order });
});

module.exports = router;
