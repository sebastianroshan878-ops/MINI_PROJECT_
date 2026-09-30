const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema(
  {
    code: { type: String, unique: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    customerName: { type: String, required: true, trim: true },
    phone: { type: String, required: true },
    email: { type: String, default: '' },
    date: { type: String, required: true }, // "2026-09-25"
    time: { type: String, required: true }, // "19:30"
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    guests: { type: Number, required: true, min: 1 },
    specialRequests: { type: String, default: '', maxlength: 300 },
    seatingPreference: { type: String, default: 'no-preference' },
    table: { type: mongoose.Schema.Types.ObjectId, ref: 'Table', required: true },
    status: { type: String, enum: ['confirmed', 'seated', 'completed', 'cancelled', 'no-show'], default: 'confirmed' },
    fromWaitlist: { type: Boolean, default: false },
  },
  { timestamps: true }
);

reservationSchema.index({ startAt: 1, endAt: 1 });

module.exports = mongoose.model('Reservation', reservationSchema);
