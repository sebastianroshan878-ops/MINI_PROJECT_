const mongoose = require('mongoose');

// In-app notifications (the bell icon). A notification is for one customer, one staff user, or all staff.
const notificationSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    forStaff: { type: Boolean, default: false },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, default: 'info' }, // reservation, order, payment, loyalty, task ...
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);
