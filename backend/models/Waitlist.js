const mongoose = require('mongoose');

// Guests who wanted a table that was already full. They are served first-come, first-served.
const waitlistSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    customerName: { type: String, required: true, trim: true },
    phone: { type: String, required: true },
    email: { type: String, default: '' },
    date: { type: String, required: true },
    time: { type: String, required: true },
    startAt: { type: Date, required: true },
    guests: { type: Number, required: true, min: 1 },
    specialRequests: { type: String, default: '' },
    seatingPreference: { type: String, default: 'no-preference' },
    status: { type: String, enum: ['waiting', 'promoted', 'cancelled'], default: 'waiting' },
    reservation: { type: mongoose.Schema.Types.ObjectId, ref: 'Reservation' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Waitlist', waitlistSchema);
