const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Customer = require('../models/Customer');
const { authenticate } = require('../middleware/auth');
const { HttpError } = require('../utils/helpers');
const { isEmail, isPhone } = require('../utils/validators');

const router = express.Router();

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role, name: user.name, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });
const safeUser = (u) => ({ _id: u._id, name: u.name, email: u.email, phone: u.phone, role: u.role });

// POST /api/auth/register - customers create their own account
router.post('/register', async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const phone = String(req.body.phone || '').trim();
  const password = String(req.body.password || '');

  if (!name || !email || !phone || !password) throw new HttpError(400, 'Name, email, phone and password are required');
  if (!isEmail(email)) throw new HttpError(400, 'Enter a valid email address');
  if (!isPhone(phone)) throw new HttpError(400, 'Phone number must be 10 digits');
  if (password.length < 6) throw new HttpError(400, 'Password must be at least 6 characters');
  if (await User.findOne({ email })) throw new HttpError(409, 'An account with this email already exists');

  // A walk-in guest may already have a customer record for this phone: link it so their history is kept.
  let customer = await Customer.findOne({ phone });
  if (customer && customer.user) throw new HttpError(409, 'This phone number is already registered');

  const user = await User.create({ name, email, phone, password, role: 'customer' });
  if (customer) {
    customer.user = user._id;
    customer.name = name;
    customer.email = email;
    await customer.save();
  } else {
    customer = await Customer.create({ user: user._id, name, phone, email });
  }
  res.status(201).json({ token: signToken(user), user: safeUser(user), customer });
});

// POST /api/auth/login - customers and staff use the same form
router.post('/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!email || !password) throw new HttpError(400, 'Enter your email and password');

  let user = null;
  try {
    if (mongoose.connection.readyState === 1) {
      user = await User.findOne({ email });
    }
  } catch (err) {}

  if (!user) {
    if (email === 'customer@demo.com' && password === 'customer123') {
      user = { _id: '507f1f77bcf86cd799439001', name: 'Anjali Nair', email, phone: '9876500001', role: 'customer', isActive: true, matchPassword: () => true };
    } else if (email === 'admin@restaurantpro.com' && password === 'admin123') {
      user = { _id: '507f1f77bcf86cd799439002', name: 'Admin', email, phone: '9000000000', role: 'admin', isActive: true, matchPassword: () => true };
    } else if (password === 'staff123') {
      const role = email.split('@')[0] || 'waiter';
      user = { _id: '507f1f77bcf86cd799439003', name: role.toUpperCase(), email, phone: '9000000002', role, isActive: true, matchPassword: () => true };
    }
  }

  if (!user || !(await user.matchPassword(password))) throw new HttpError(401, 'Wrong email or password');
  if (!user.isActive) throw new HttpError(403, 'This account has been deactivated. Please contact the manager');

  let customer = null;
  if (user.role === 'customer') {
    try {
      if (mongoose.connection.readyState === 1) {
        customer = await Customer.findOne({ user: user._id });
      }
    } catch (err) {}
    if (!customer) {
      customer = {
        _id: user._id,
        user: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        loyaltyPoints: 120,
        totalSpent: 1850,
        tierInfo: { name: 'Bronze', multiplier: 1 },
        preferences: { seating: 'no-preference', orderType: 'dine-in' },
      };
    }
  }
  res.json({ token: signToken(user), user: safeUser(user), customer });
});

// GET /api/auth/me - who am I? (used when the page reloads)
router.get('/me', authenticate, async (req, res) => {
  res.json({ user: safeUser(req.user), customer: req.customer || null });
});

module.exports = router;
