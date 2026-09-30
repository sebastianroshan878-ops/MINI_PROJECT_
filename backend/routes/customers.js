const express = require('express');
const Customer = require('../models/Customer');
const User = require('../models/User');
const Order = require('../models/Order');
const Reservation = require('../models/Reservation');
const Feedback = require('../models/Feedback');
const { authenticate, authorize } = require('../middleware/auth');
const { getTier, getNextTier } = require('../services/loyalty');
const { notify } = require('../services/notify');
const { HttpError, escapeRegex } = require('../utils/helpers');
const { isEmail } = require('../utils/validators');

const router = express.Router();

// Adds tier details (name, bonus multiplier, points needed for the next tier) to a customer
function withLoyalty(customer) {
  const tier = getTier(customer.lifetimePoints);
  const next = getNextTier(customer.lifetimePoints);
  return {
    ...customer.toJSON(),
    tierInfo: {
      name: tier.name,
      multiplier: tier.multiplier,
      next: next ? { name: next.name, pointsNeeded: next.min - customer.lifetimePoints } : null,
    },
  };
}

function requireCustomer(req, res, next) {
  if (!req.customer) return res.status(403).json({ message: 'Only customers have a profile' });
  next();
}

// GET /api/customers/me - my profile, preferences and loyalty
router.get('/me', authenticate, requireCustomer, async (req, res) => {
  res.json(withLoyalty(req.customer));
});

// PUT /api/customers/me - update details and dining / ordering preferences
router.put('/me', authenticate, requireCustomer, async (req, res) => {
  const customer = req.customer;
  const body = req.body;

  if (body.name !== undefined) {
    if (!String(body.name).trim()) throw new HttpError(400, 'Name cannot be empty');
    customer.name = String(body.name).trim();
    await User.updateOne({ _id: req.user._id }, { name: customer.name });
  }
  if (body.email !== undefined) {
    if (body.email && !isEmail(body.email)) throw new HttpError(400, 'Enter a valid email address');
    customer.email = body.email;
  }
  if (body.address !== undefined) customer.address = String(body.address).trim();
  if (body.preferences) {
    ['seating', 'diet', 'spiceLevel', 'orderType'].forEach((key) => {
      if (body.preferences[key] !== undefined) customer.set(`preferences.${key}`, body.preferences[key]);
    });
  }
  await customer.save();
  res.json(withLoyalty(customer));
});

// ----- staff views -----------------------------------------------------------

// GET /api/customers?search=anj
router.get('/', authenticate, authorize('admin', 'manager', 'waiter'), async (req, res) => {
  const query = {};
  if (req.query.search) {
    const regex = new RegExp(escapeRegex(req.query.search), 'i');
    query.$or = [{ name: regex }, { phone: regex }, { email: regex }];
  }
  const customers = await Customer.find(query).sort({ createdAt: -1 }).limit(200);
  res.json(customers.map(withLoyalty));
});

// GET /api/customers/:id - full profile with order history
router.get('/:id', authenticate, authorize('admin', 'manager', 'waiter'), async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) throw new HttpError(404, 'Customer not found');
  const orders = await Order.find({ customer: customer._id }).sort({ createdAt: -1 }).limit(20);
  const reservations = await Reservation.find({ customer: customer._id }).populate('table', 'number').sort({ startAt: -1 }).limit(10);
  const feedback = await Feedback.find({ customer: customer._id }).sort({ createdAt: -1 }).limit(10);
  res.json({ customer: withLoyalty(customer), orders, reservations, feedback });
});

// POST /api/customers/:id/points - manager gives (or removes) loyalty points, e.g. a birthday bonus
router.post('/:id/points', authenticate, authorize('admin', 'manager'), async (req, res) => {
  const points = parseInt(req.body.points, 10);
  if (!points || Math.abs(points) > 1000) throw new HttpError(400, 'Enter points between -1000 and 1000 (not 0)');
  const customer = await Customer.findById(req.params.id);
  if (!customer) throw new HttpError(404, 'Customer not found');

  customer.loyaltyPoints = Math.max(0, customer.loyaltyPoints + points);
  if (points > 0) customer.lifetimePoints += points; // bonus points count towards the tier
  await customer.save();

  await notify({
    customer: customer._id,
    type: 'loyalty',
    title: points > 0 ? 'Bonus loyalty points' : 'Loyalty points adjusted',
    message: `${points > 0 ? '+' : ''}${points} points${req.body.reason ? `: ${req.body.reason}` : ''}. Balance: ${customer.loyaltyPoints}`,
  });
  res.json(withLoyalty(customer));
});

module.exports = router;
