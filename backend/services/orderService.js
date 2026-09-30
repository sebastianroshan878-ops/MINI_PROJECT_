const mongoose = require('mongoose');
const MenuItem = require('../models/MenuItem');
const DEFAULT_MENU_ITEMS = require('../config/defaultMenu');
const { refundPayment } = require('./paymentService');
const { reverseRewards } = require('./loyalty');
const { notify } = require('./notify');
const { HttpError, round2 } = require('../utils/helpers');
const C = require('../config/constants');

// Turn the cart sent by the browser into trusted order lines.
// Prices are ALWAYS read from the database/default items, never from the browser.
async function buildOrderItems(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) throw new HttpError(400, 'Your cart is empty');

  let menu = [];
  try {
    if (mongoose.connection.readyState === 1) {
      menu = await MenuItem.find({ _id: { $in: rawItems.map((i) => i.menuItem).filter((id) => mongoose.isValidObjectId(id)) } });
    }
  } catch (err) {}

  const byId = new Map(menu.map((m) => [String(m._id), m]));

  const items = [];
  const demand = {}; // total portions wanted per menu item
  let subtotal = 0;

  for (const raw of rawItems) {
    let dish = byId.get(String(raw.menuItem));
    if (!dish) {
      dish = DEFAULT_MENU_ITEMS.find(
        (d) => String(d._id) === String(raw.menuItem) || (raw.name && d.name.toLowerCase() === String(raw.name).toLowerCase())
      );
    }
    if (!dish) throw new HttpError(400, 'One of the items is no longer on the menu');

    const quantity = parseInt(raw.quantity, 10);
    if (!quantity || quantity < 1 || quantity > 20) throw new HttpError(400, `Choose 1 to 20 portions of ${dish.name}`);
    demand[dish._id || dish.id] = (demand[dish._id || dish.id] || 0) + quantity;
    if (!dish.isAvailable || dish.stock < demand[dish.id]) {
      throw new HttpError(400, `${dish.name} is sold out or has fewer portions left than you asked for`);
    }

    // add-ons must exist on the dish
    const addOns = [];
    (raw.addOns || []).forEach((name) => {
      const found = dish.addOns.find((a) => a.name === name);
      if (!found) throw new HttpError(400, `${name} is not available for ${dish.name}`);
      addOns.push({ name: found.name, price: found.price });
    });

    const spiceLevel = dish.hasSpiceLevel && ['mild', 'medium', 'hot'].includes(raw.spiceLevel) ? raw.spiceLevel : '';
    const unitPrice = dish.price + addOns.reduce((sum, a) => sum + a.price, 0);
    const lineTotal = round2(unitPrice * quantity);
    subtotal += lineTotal;

    items.push({
      menuItem: dish._id,
      name: dish.name,
      emoji: dish.emoji,
      category: dish.category,
      price: unitPrice,
      quantity,
      addOns,
      spiceLevel,
      note: String(raw.note || '').trim().slice(0, 120),
      lineTotal,
    });
  }
  return { items, subtotal: round2(subtotal), demand, menu };
}

// Bill maths: subtotal - loyalty discount + GST + delivery charge
function computeTotals({ subtotal, type, redeemPoints = 0, availablePoints = 0 }) {
  const maxRedeem = Math.floor(subtotal * C.MAX_REDEEM_PERCENT);
  const discount = Math.max(0, Math.min(redeemPoints, availablePoints, maxRedeem));
  const taxable = subtotal - discount;
  const gst = round2(taxable * C.GST_RATE);
  const deliveryCharge = type === 'delivery' && subtotal < C.FREE_DELIVERY_ABOVE ? C.DELIVERY_CHARGE : 0;
  const total = round2(taxable + gst + deliveryCharge);
  return { discount, gst, deliveryCharge, total };
}

// Availability tracking: reduce stock after an order, and mark an item sold out at zero.
async function reduceStock(menu, demand) {
  for (const dish of menu) {
    const qty = demand[dish._id || dish.id] || 0;
    if (!qty) continue;
    dish.stock = Math.max(0, dish.stock - qty);
    if (dish.stock === 0) dish.isAvailable = false;
    if (typeof dish.save === 'function') await dish.save();
  }
}

async function restoreStock(order) {
  for (const line of order.items) {
    const dish = await MenuItem.findById(line.menuItem);
    if (!dish) continue;
    const wasSoldOut = dish.stock <= 0;
    dish.stock += line.quantity;
    if (wasSoldOut) dish.isAvailable = true;
    await dish.save();
  }
}

// Cancel an order: put stock back, refund the payment (if paid) and give back loyalty points.
async function cancelOrder(order, reason, cancelledBy) {
  order.status = 'cancelled';
  order.cancelReason = reason;
  order.cancelledBy = cancelledBy;
  order.statusHistory.push({ status: 'cancelled', at: new Date() });
  await restoreStock(order);

  if (order.paymentStatus === 'paid') {
    await refundPayment(order, `Order cancelled: ${reason}`);
  } else {
    await reverseRewards(order, { wasPaid: false });
  }
  await order.save();

  if (order.customer) {
    await notify({
      customer: order.customer,
      type: 'order',
      title: 'Order cancelled',
      message: `${order.orderNumber} was cancelled. ${order.paymentStatus === 'refunded' ? 'Your payment has been refunded.' : ''}`,
    });
  }
  await notify({ forStaff: true, type: 'order', title: 'Order cancelled', message: `${order.orderNumber} - ${reason}` });
  return order;
}

module.exports = { buildOrderItems, computeTotals, reduceStock, restoreStock, cancelOrder };
