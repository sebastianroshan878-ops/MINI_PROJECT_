const mongoose = require('mongoose');
const { TIERS } = require('../config/constants');

// Customer profile: contact details, preferences and loyalty points.
// "user" is empty for walk-in customers who never created an online account.
const customerSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    name: { type: String, required: [true, 'Name is required'], trim: true },
    phone: { type: String, required: [true, 'Phone is required'], unique: true, trim: true },
    email: { type: String, trim: true, lowercase: true, default: '' },
    address: { type: String, trim: true, default: '' },
    preferences: {
      seating: { type: String, enum: ['no-preference', 'indoor', 'outdoor', 'window', 'quiet-corner'], default: 'no-preference' },
      diet: { type: String, enum: ['any', 'veg', 'non-veg', 'vegan'], default: 'any' },
      spiceLevel: { type: String, enum: ['mild', 'medium', 'hot'], default: 'medium' },
      orderType: { type: String, enum: ['parcel', 'delivery'], default: 'delivery' },
    },
    loyaltyPoints: { type: Number, default: 0, min: 0 },
    lifetimePoints: { type: Number, default: 0, min: 0 },
    totalSpent: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// Tier is worked out from lifetime points (Bronze -> Silver -> Gold)
customerSchema.virtual('tier').get(function () {
  let tier = TIERS[0].name;
  TIERS.forEach((t) => {
    if ((this.lifetimePoints || 0) >= t.min) tier = t.name;
  });
  return tier;
});

module.exports = mongoose.model('Customer', customerSchema);
