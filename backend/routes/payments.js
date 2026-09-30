const express = require('express');
const Payment = require('../models/Payment');
const Order = require('../models/Order');
const { authenticate, authorize } = require('../middleware/auth');
const { payOrder, refundPayment } = require('../services/paymentService');
const { WALLETS } = require('../services/paymentGateway');
const { HttpError, round2 } = require('../utils/helpers');

const router = express.Router();
const CASHIERS = ['admin', 'manager', 'waiter', 'delivery'];

// GET /api/payments/wallets - wallet names for the payment form
router.get('/wallets', (req, res) => res.json(WALLETS));

// POST /api/payments/pay - pay for an order (card / UPI / wallet online, cash by staff)
router.post('/pay', authenticate, async (req, res) => {
  const { orderId, method, details } = req.body;
  const order = await Order.findById(orderId);
  if (!order) throw new HttpError(404, 'Order not found');

  const isStaff = CASHIERS.includes(req.user.role);
  const isOwner = !!req.customer && String(order.customer) === String(req.customer._id);
  if (!isStaff && !isOwner) throw new HttpError(403, 'You cannot pay for this order');

  const payment = await payOrder({ order, method, details: details || {}, byStaff: isStaff });
  res.json({ payment, order });
});

// GET /api/payments - all transactions (manager / admin)
router.get('/', authenticate, authorize('admin', 'manager'), async (req, res) => {
  const query = {};
  if (req.query.status) query.status = req.query.status;
  if (req.query.method) query.method = req.query.method;
  const payments = await Payment.find(query).populate('order', 'orderNumber type').sort({ createdAt: -1 }).limit(200);

  const all = await Payment.find();
  const collected = round2(all.filter((p) => p.status === 'success').reduce((s, p) => s + p.amount, 0));
  const refunded = round2(all.filter((p) => p.status === 'refunded').reduce((s, p) => s + p.amount, 0));
  const failed = all.filter((p) => p.status === 'failed').length;
  res.json({ payments, summary: { collected, refunded, failed, count: all.length } });
});

// POST /api/payments/:id/refund - manager refunds a payment
router.post('/:id/refund', authenticate, authorize('admin', 'manager'), async (req, res) => {
  const reason = String(req.body.reason || '').trim();
  if (!reason) throw new HttpError(400, 'Write the reason for the refund');

  const payment = await Payment.findById(req.params.id);
  if (!payment) throw new HttpError(404, 'Payment not found');
  if (payment.status !== 'success') throw new HttpError(400, `A ${payment.status} payment cannot be refunded`);

  const order = await Order.findById(payment.order);
  if (!order) throw new HttpError(404, 'The order for this payment was not found');
  const refunded = await refundPayment(order, reason);
  res.json({ payment: refunded, order });
});

module.exports = router;
