const Customer = require('../models/Customer');

// Walk-in guests and phone bookings get a customer record automatically (matched by phone number).
async function findOrCreateCustomer(name, phone) {
  let customer = await Customer.findOne({ phone });
  if (!customer) customer = await Customer.create({ name: name || 'Guest', phone });
  return customer;
}

module.exports = { findOrCreateCustomer };
