const mongoose = require('mongoose');

// A physical table in the restaurant.
// "status" is the live state set by staff. "reserved" is worked out automatically from reservations.
const tableSchema = new mongoose.Schema(
  {
    number: { type: Number, required: [true, 'Table number is required'], unique: true, min: 1 },
    capacity: { type: Number, required: [true, 'Seats are required'], min: 1, max: 20 },
    location: { type: String, enum: ['indoor', 'outdoor', 'window', 'quiet-corner'], default: 'indoor' },
    status: { type: String, enum: ['available', 'occupied', 'cleaning'], default: 'available' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Table', tableSchema);
