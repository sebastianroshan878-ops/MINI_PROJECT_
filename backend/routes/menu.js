const express = require('express');
const mongoose = require('mongoose');
const MenuItem = require('../models/MenuItem');
const Order = require('../models/Order');
const { authenticate, authorize } = require('../middleware/auth');
const { HttpError, escapeRegex } = require('../utils/helpers');
const DEFAULT_MENU_ITEMS = require('../config/defaultMenu');

const router = express.Router();

// In-memory collection of menu items initialized with the rich default catalogue
let memoryMenuItems = DEFAULT_MENU_ITEMS.map((item) => ({ ...item }));

// Clean the data sent from the admin form before saving it
function cleanBody(body) {
  const data = {};
  ['name', 'description', 'category', 'emoji', 'image'].forEach((k) => {
    if (body[k] !== undefined) data[k] = String(body[k]).trim();
  });
  ['price', 'prepTime', 'stock', 'rating', 'reviewsCount'].forEach((k) => {
    if (body[k] !== undefined && body[k] !== '') data[k] = Number(body[k]);
  });
  ['hasSpiceLevel', 'isAvailable', 'isSpecial'].forEach((k) => {
    if (body[k] !== undefined) data[k] = !!body[k];
  });
  if (Array.isArray(body.dietary)) {
    data.dietary = [...new Set(body.dietary)];
    if (data.dietary.includes('vegan') && !data.dietary.includes('veg')) data.dietary.push('veg');
  }
  if (Array.isArray(body.addOns)) {
    data.addOns = body.addOns
      .filter((a) => a && String(a.name || '').trim() && Number(a.price) >= 0)
      .map((a) => ({ name: String(a.name).trim(), price: Number(a.price) }));
  }
  return data;
}

// Check if category matches strictly
function categoryMatches(dishCategory, targetCategory) {
  if (!dishCategory || !targetCategory) return false;
  const dc = dishCategory.trim().toLowerCase();
  const tc = targetCategory.trim().toLowerCase();
  if (tc === 'all') return true;
  if (dc === tc) return true;
  // Specific alias matching
  if (tc === 'burger' || tc === 'burgers') return dc === 'burger' || dc === 'burgers';
  if (tc === 'drinks' || tc === 'beverages') return dc === 'drinks' || dc === 'beverages';
  if (tc === 'biryani') return dc === 'biryani' || dc === 'biryani & rice';
  return false;
}

// Enrich item with specific photo if missing
function enrichItem(item) {
  const obj = item.toObject ? item.toObject() : { ...item };
  if (!obj.image) {
    const dishName = (obj.name || '').toLowerCase();
    // Try to find exact or close match in default menu
    const exact = DEFAULT_MENU_ITEMS.find((d) => d.name.toLowerCase() === dishName);
    if (exact) {
      obj.image = exact.image;
    } else {
      // Find item with same category and shared keyword
      const keywordMatch = DEFAULT_MENU_ITEMS.find((d) => {
        if (!categoryMatches(d.category, obj.category)) return false;
        const words = dishName.split(/\s+/).filter((w) => w.length > 3);
        return words.some((w) => d.name.toLowerCase().includes(w));
      });
      if (keywordMatch) {
        obj.image = keywordMatch.image;
      } else {
        // Fallback to primary category representative
        const catMatch = DEFAULT_MENU_ITEMS.find((d) => categoryMatches(d.category, obj.category));
        obj.image = catMatch ? catMatch.image : '/images/food/starters.jpg';
      }
    }
  }
  obj.rating = obj.rating || 4.8;
  obj.reviewsCount = obj.reviewsCount || 150;
  return obj;
}

// GET /api/menu?category=&diet=veg&glutenFree=true&search=paneer (public)
router.get('/', async (req, res) => {
  const categoryParam = req.query.category && req.query.category !== 'All' ? String(req.query.category).trim() : null;
  const dietParam = req.query.diet && req.query.diet !== 'all' ? req.query.diet : null;
  const searchParam = req.query.search ? String(req.query.search).trim() : '';

  let items = [];

  try {
    if (mongoose.connection.readyState === 1) {
      const dbItems = await MenuItem.find({}).sort({ category: 1, name: 1 });
      if (Array.isArray(dbItems) && dbItems.length > 0) {
        items = dbItems.map(enrichItem);
      }
    }
  } catch (err) {
    console.warn('DB menu fetch warning:', err.message);
  }

  // If DB returned nothing or is offline, use memoryMenuItems
  if (!items.length) {
    items = memoryMenuItems.map(enrichItem);
  } else {
    // Merge any memory-only additions that aren't in the DB yet
    const dbNames = new Set(items.map((i) => i.name.toLowerCase()));
    memoryMenuItems.forEach((m) => {
      if (!dbNames.has(m.name.toLowerCase())) {
        items.push(enrichItem(m));
      }
    });
  }

  // 1. Strict Category Filter
  if (categoryParam) {
    items = items.filter((d) => categoryMatches(d.category, categoryParam));
  }

  // 2. Dietary Tag Filter
  if (dietParam) {
    items = items.filter((d) => Array.isArray(d.dietary) && d.dietary.includes(dietParam));
  }
  if (req.query.glutenFree === 'true') {
    items = items.filter((d) => Array.isArray(d.dietary) && d.dietary.includes('gluten-free'));
  }

  // 3. Search Filter across dish name, description, and keywords
  if (searchParam) {
    const q = searchParam.toLowerCase();
    items = items.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        (d.description && d.description.toLowerCase().includes(q)) ||
        d.category.toLowerCase().includes(q) ||
        (Array.isArray(d.dietary) && d.dietary.some((tag) => tag.toLowerCase().includes(q)))
    );
  }

  res.json(items);
});

// GET /api/menu/popular - the 6 most ordered dishes (falls back to chef's specials)
router.get('/popular', async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const top = await Order.aggregate([
        { $match: { status: { $ne: 'cancelled' } } },
        { $unwind: '$items' },
        { $group: { _id: '$items.menuItem', quantity: { $sum: '$items.quantity' } } },
        { $sort: { quantity: -1 } },
        { $limit: 6 },
      ]);
      let items = await MenuItem.find({ _id: { $in: top.map((t) => t._id) }, isAvailable: true });
      items = items.sort((a, b) => {
        const qa = top.find((t) => String(t._id) === String(a._id)).quantity;
        const qb = top.find((t) => String(t._id) === String(b._id)).quantity;
        return qb - qa;
      });
      if (items.length < 4) items = await MenuItem.find({ isSpecial: true, isAvailable: true }).limit(6);
      if (items.length > 0) return res.json(items.map(enrichItem));
    }
  } catch (err) {
    // Fallback
  }
  res.json(DEFAULT_MENU_ITEMS.filter((d) => d.isSpecial).slice(0, 6).map(enrichItem));
});

// Menu customization by managers & admin ------------------------------------------------
router.post('/', authenticate, authorize('admin', 'manager'), async (req, res) => {
  const cleaned = cleanBody(req.body);
  if (!cleaned.name) throw new HttpError(400, 'Food name is required');
  if (!cleaned.category) throw new HttpError(400, 'Category is required');
  if (!cleaned.price || cleaned.price < 1) throw new HttpError(400, 'Valid price is required');

  let savedItem = null;
  try {
    if (mongoose.connection.readyState === 1) {
      savedItem = await MenuItem.create(cleaned);
    }
  } catch (err) {
    console.warn('DB dish create warning:', err.message);
  }

  const memoryItem = {
    _id: savedItem ? String(savedItem._id) : 'menu_' + Date.now(),
    name: cleaned.name,
    category: cleaned.category,
    price: cleaned.price,
    description: cleaned.description || '',
    image: cleaned.image || '',
    emoji: cleaned.emoji || '🍽️',
    rating: 4.8,
    reviewsCount: 1,
    prepTime: cleaned.prepTime || 15,
    stock: cleaned.stock !== undefined ? cleaned.stock : 50,
    isAvailable: cleaned.isAvailable !== undefined ? cleaned.isAvailable : true,
    isSpecial: cleaned.isSpecial || false,
    dietary: cleaned.dietary || ['veg'],
    addOns: cleaned.addOns || [],
  };

  memoryMenuItems.unshift(memoryItem);
  res.status(201).json(savedItem ? enrichItem(savedItem) : enrichItem(memoryItem));
});

router.put('/:id', authenticate, authorize('admin', 'manager'), async (req, res) => {
  const cleaned = cleanBody(req.body);
  let saved = null;
  try {
    if (mongoose.connection.readyState === 1) {
      const item = await MenuItem.findById(req.params.id);
      if (item) {
        Object.assign(item, cleaned);
        await item.save();
        saved = item;
      }
    }
  } catch {}

  const idx = memoryMenuItems.findIndex((m) => String(m._id) === String(req.params.id));
  if (idx !== -1) {
    memoryMenuItems[idx] = { ...memoryMenuItems[idx], ...cleaned };
  } else if (!saved) {
    throw new HttpError(404, 'Menu item not found');
  }

  res.json(saved ? enrichItem(saved) : enrichItem(memoryMenuItems[idx]));
});

// PATCH /api/menu/:id/availability - quick sold-out switch and stock update
router.patch('/:id/availability', authenticate, authorize('admin', 'manager', 'chef'), async (req, res) => {
  let saved = null;
  try {
    if (mongoose.connection.readyState === 1) {
      const item = await MenuItem.findById(req.params.id);
      if (item) {
        if (req.body.stock !== undefined) {
          const stock = Number(req.body.stock);
          if (!Number.isInteger(stock) || stock < 0) throw new HttpError(400, 'Stock must be 0 or more');
          item.stock = stock;
          if (stock === 0) item.isAvailable = false;
        }
        if (req.body.isAvailable !== undefined) item.isAvailable = !!req.body.isAvailable;
        await item.save();
        saved = item;
      }
    }
  } catch {}

  const idx = memoryMenuItems.findIndex((m) => String(m._id) === String(req.params.id));
  if (idx !== -1) {
    if (req.body.stock !== undefined) memoryMenuItems[idx].stock = Number(req.body.stock);
    if (req.body.isAvailable !== undefined) memoryMenuItems[idx].isAvailable = !!req.body.isAvailable;
  }

  res.json(saved || memoryMenuItems[idx] || { message: 'Availability updated' });
});

router.delete('/:id', authenticate, authorize('admin', 'manager'), async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      await MenuItem.findByIdAndDelete(req.params.id);
    }
  } catch {}
  memoryMenuItems = memoryMenuItems.filter((m) => String(m._id) !== String(req.params.id));
  res.json({ message: 'Menu item deleted' });
});

module.exports = router;
