require('dotenv').config();
process.env.JWT_SECRET = process.env.JWT_SECRET || 'restaurantpro_dev_secret';

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
mongoose.set('bufferCommands', false);
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const User = require('./models/User');
const C = require('./config/constants');

const app = express();
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  req.body = req.body || {}; // requests without a body still have an (empty) req.body
  next();
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', app: 'LUMORA' }));

// Business settings the React app needs (GST rate, opening hours, delivery charge ...)
app.get('/api/config', (req, res) => {
  res.json({
    restaurant: C.RESTAURANT,
    openTime: C.OPEN_TIME,
    closeTime: C.CLOSE_TIME,
    lastReservationTime: C.LAST_RESERVATION_TIME,
    reservationMinutes: C.RESERVATION_MINUTES,
    gstRate: C.GST_RATE,
    deliveryCharge: C.DELIVERY_CHARGE,
    freeDeliveryAbove: C.FREE_DELIVERY_ABOVE,
    minLeadMinutes: C.MIN_LEAD_MINUTES,
    pointsPerRupees: C.POINTS_PER_RUPEES,
    maxRedeemPercent: C.MAX_REDEEM_PERCENT,
    tiers: C.TIERS,
    menuCategories: C.MENU_CATEGORIES,
    orderFlow: C.ORDER_FLOW,
    roleStatus: C.ROLE_STATUS,
    statusLabels: C.STATUS_LABELS,
  });
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/menu', require('./routes/menu'));
app.use('/api/tables', require('./routes/tables'));
app.use('/api/reservations', require('./routes/reservations'));
app.use('/api/waitlist', require('./routes/waitlist'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/feedback', require('./routes/feedback'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/staff', require('./routes/staff'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/attendance', require('./routes/attendance'));

app.use('/api', (req, res) => res.status(404).json({ message: 'API route not found' }));
app.use(errorHandler);

// So you can always log in the first time, an admin account is created when none exists.
async function ensureAdmin() {
  const admin = await User.findOne({ role: 'admin' });
  if (!admin) {
    await User.create({ name: 'Admin', email: 'admin@restaurantpro.com', phone: '9000000000', password: 'admin123', role: 'admin' });
    console.log('Created default admin: admin@restaurantpro.com / admin123');
  }
}

const PORT = process.env.PORT || 5000;

if (require.main === module) {
  connectDB({ exitOnError: false })
    .then((connected) => {
      if (connected) return ensureAdmin();
      // Auto-retry in background every 10 seconds if initial connection failed
      const retryTimer = setInterval(async () => {
        const ok = await connectDB({ exitOnError: false, timeoutMs: 3000 });
        if (ok) {
          clearInterval(retryTimer);
          await ensureAdmin();
        }
      }, 10000);
    })
    .catch((err) => {
      console.warn('DB initialization error:', err.message);
    })
    .finally(() => {
      app.listen(PORT, () => console.log(`LUMORA API running on http://localhost:${PORT}`));
    });
}

module.exports = app;
