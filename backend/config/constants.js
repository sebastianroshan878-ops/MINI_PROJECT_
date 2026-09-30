// All business rules live here so they are easy to find and explain.
module.exports = {
  RESTAURANT: {
    name: 'LUMORA',
    tagline: 'Fresh flavours. Memorable moments.',
    address: '12 Spice Street, Main Market Road',
    phone: '+91 98765 43210',
    gstin: '29ABCDE1234F1Z5 (sample)',
  },

  // Opening hours (24h format, compared as text so "09:30" < "11:00")
  OPEN_TIME: '11:00',
  CLOSE_TIME: '23:00',
  LAST_RESERVATION_TIME: '21:30',
  RESERVATION_MINUTES: 90, // one booking holds a table for 90 minutes

  // Billing
  GST_RATE: 0.05,
  DELIVERY_CHARGE: 40,
  FREE_DELIVERY_ABOVE: 500,
  MIN_LEAD_MINUTES: 20, // scheduled pickup/delivery must be at least this far ahead

  // Loyalty: 1 point per Rs.10 spent, 1 point = Rs.1 off, max 20% of the subtotal
  POINTS_PER_RUPEES: 10,
  MAX_REDEEM_PERCENT: 0.2,
  TIERS: [
    { name: 'Bronze', min: 0, multiplier: 1 },
    { name: 'Silver', min: 200, multiplier: 1.25 },
    { name: 'Gold', min: 500, multiplier: 1.5 },
  ],

  MENU_CATEGORIES: [
    'Biryani',
    'Pizza',
    'Burger',
    'Alfaham',
    'Pasta',
    'Fried Rice',
    'Noodles',
    'Shawarma',
    'Fried Chicken',
    'Starters',
    'Desserts',
    'Ice Cream',
    'Drinks',
    'Main Course',
    'Biryani & Rice',
    'Breads',
    'Beverages',
  ],

  STAFF_ROLES: ['admin', 'manager', 'waiter', 'chef', 'delivery'],

  // Order life cycle for each order type
  ORDER_FLOW: {
    'dine-in': ['placed', 'preparing', 'ready', 'completed'],
    parcel: ['placed', 'confirmed', 'preparing', 'ready', 'completed'],
    delivery: ['placed', 'confirmed', 'preparing', 'ready', 'out-for-delivery', 'completed'],
  },

  // Which order statuses each staff role may set
  ROLE_STATUS: {
    admin: ['confirmed', 'preparing', 'ready', 'out-for-delivery', 'completed'],
    manager: ['confirmed', 'preparing', 'ready', 'out-for-delivery', 'completed'],
    waiter: ['confirmed', 'preparing', 'ready', 'completed'],
    chef: ['confirmed', 'preparing', 'ready'],
    delivery: ['out-for-delivery', 'completed'],
  },

  STATUS_LABELS: {
    placed: 'Order placed',
    confirmed: 'Confirmed',
    preparing: 'Being prepared',
    ready: 'Ready',
    'out-for-delivery': 'Out for delivery',
    completed: 'Completed',
    cancelled: 'Cancelled',
  },

  // Target time (minutes) used to judge "on-time" orders
  EXPECTED_MINUTES: { 'dine-in': 30, parcel: 25, delivery: 45 },
};
