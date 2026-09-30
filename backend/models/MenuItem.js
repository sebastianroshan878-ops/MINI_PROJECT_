const mongoose = require('mongoose');
const { MENU_CATEGORIES } = require('../config/constants');

const addOnSchema = new mongoose.Schema(
  { name: { type: String, required: true, trim: true }, price: { type: Number, required: true, min: 0 } },
  { _id: false }
);

const menuItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Item name is required'], trim: true },
    description: { type: String, default: '', trim: true },
    category: { type: String, required: [true, 'Category is required'], trim: true },
    price: { type: Number, required: [true, 'Price is required'], min: [1, 'Price must be at least 1'] },
    emoji: { type: String, default: '🍽️' },
    dietary: [{ type: String, enum: ['veg', 'non-veg', 'vegan', 'gluten-free'] }],
    hasSpiceLevel: { type: Boolean, default: false }, // customer can choose mild / medium / hot
    addOns: [addOnSchema], // optional extras such as "Extra cheese"
    image: { type: String, default: '' },
    rating: { type: Number, default: 4.8 },
    reviewsCount: { type: Number, default: 120 },
    prepTime: { type: Number, default: 15 }, // minutes
    stock: { type: Number, default: 50, min: 0 }, // portions left today
    isAvailable: { type: Boolean, default: true },
    isSpecial: { type: Boolean, default: false }, // shown as "chef's special"
  },
  { timestamps: true }
);

module.exports = mongoose.model('MenuItem', menuItemSchema);
