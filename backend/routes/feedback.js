const express = require('express');
const Feedback = require('../models/Feedback');
const Order = require('../models/Order');
const { authenticate, authorize } = require('../middleware/auth');
const { HttpError } = require('../utils/helpers');
const { notify } = require('../services/notify');

const router = express.Router();

// GET /api/feedback/public - good reviews for the home page
router.get('/public', async (req, res) => {
  const reviews = await Feedback.find({ rating: { $gte: 4 }, comment: { $ne: '' } })
    .sort({ createdAt: -1 })
    .limit(6)
    .select('customerName rating comment createdAt');
  res.json(reviews);
});

// GET /api/feedback/mine
router.get('/mine', authenticate, async (req, res) => {
  if (!req.customer) return res.json([]);
  res.json(await Feedback.find({ customer: req.customer._id }).sort({ createdAt: -1 }));
});

// POST /api/feedback - a customer reviews a finished order (or leaves general feedback)
router.post('/', authenticate, async (req, res) => {
  if (!req.customer) throw new HttpError(403, 'Only customers can leave feedback');
  const rating = parseInt(req.body.rating, 10);
  if (!rating || rating < 1 || rating > 5) throw new HttpError(400, 'Please choose a rating from 1 to 5 stars');

  const data = {
    customer: req.customer._id,
    customerName: req.customer.name,
    rating,
    comment: String(req.body.comment || '').trim().slice(0, 500),
    type: 'general',
  };

  if (req.body.orderId) {
    const order = await Order.findById(req.body.orderId);
    if (!order || String(order.customer) !== String(req.customer._id)) throw new HttpError(404, 'Order not found');
    if (order.status !== 'completed') throw new HttpError(400, 'You can review an order after it is completed');
    if (await Feedback.findOne({ order: order._id })) throw new HttpError(409, 'You already reviewed this order');
    data.order = order._id;
    data.orderNumber = order.orderNumber;
    data.type = 'order';
  }

  const feedback = await Feedback.create(data);
  await notify({ forStaff: true, type: 'feedback', title: `New ${rating} star review`, message: data.comment || 'No comment' });
  res.status(201).json(feedback);
});

// GET /api/feedback?rating=5 - all reviews (manager / admin)
router.get('/', authenticate, authorize('admin', 'manager'), async (req, res) => {
  const query = {};
  if (req.query.rating) query.rating = Number(req.query.rating);
  res.json(await Feedback.find(query).sort({ createdAt: -1 }).limit(200));
});

// PATCH /api/feedback/:id/reply - the restaurant answers a review
router.patch('/:id/reply', authenticate, authorize('admin', 'manager'), async (req, res) => {
  const reply = String(req.body.reply || '').trim();
  if (!reply) throw new HttpError(400, 'Write a reply first');
  const feedback = await Feedback.findByIdAndUpdate(req.params.id, { reply, repliedAt: new Date() }, { new: true });
  if (!feedback) throw new HttpError(404, 'Feedback not found');
  await notify({ customer: feedback.customer, type: 'feedback', title: 'The restaurant replied to your review', message: reply });
  res.json(feedback);
});

module.exports = router;
