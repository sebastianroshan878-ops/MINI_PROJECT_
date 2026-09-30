const Customer = require('../models/Customer');
const { TIERS, POINTS_PER_RUPEES } = require('../config/constants');
const { round2 } = require('../utils/helpers');

function getTier(lifetimePoints = 0) {
  let tier = TIERS[0];
  TIERS.forEach((t) => {
    if (lifetimePoints >= t.min) tier = t;
  });
  return tier;
}

function getNextTier(lifetimePoints = 0) {
  return TIERS.find((t) => t.min > lifetimePoints) || null;
}

// Give points when an order is paid. Higher tiers earn a bonus multiplier.
async function awardPoints(order) {
  if (!order.customer) return 0;
  const customer = await Customer.findById(order.customer);
  if (!customer) return 0;

  const multiplier = getTier(customer.lifetimePoints).multiplier;
  const points = Math.floor((order.total / POINTS_PER_RUPEES) * multiplier);

  customer.loyaltyPoints += points;
  customer.lifetimePoints += points;
  customer.totalSpent = round2(customer.totalSpent + order.total);
  await customer.save();

  order.pointsEarned = points;
  return points;
}

// When an order is cancelled or refunded: take back earned points and return the points that were spent.
// The rewardsReversed flag makes sure this only ever happens once per order.
async function reverseRewards(order, { wasPaid = false } = {}) {
  if (order.rewardsReversed || !order.customer) return;
  const customer = await Customer.findById(order.customer);
  if (customer) {
    const earned = order.pointsEarned || 0;
    const redeemed = order.pointsRedeemed || 0;
    customer.loyaltyPoints = Math.max(0, customer.loyaltyPoints - earned + redeemed);
    customer.lifetimePoints = Math.max(0, customer.lifetimePoints - earned);
    if (wasPaid) customer.totalSpent = Math.max(0, round2(customer.totalSpent - order.total));
    await customer.save();
  }
  order.rewardsReversed = true;
}

module.exports = { getTier, getNextTier, awardPoints, reverseRewards };
