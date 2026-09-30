const Notification = require('../models/Notification');

// Saves an in-app notification (shown under the bell icon).
// A real project would also send an email/SMS here; we print it to the console so you can demo it.
async function notify({ customer = null, user = null, forStaff = false, title, message, type = 'info' }) {
  try {
    await Notification.create({ customer, user, forStaff, title, message, type });
    console.log(`[NOTIFICATION -> ${forStaff ? 'staff' : user ? 'staff member' : 'customer'}] ${title}: ${message}`);
  } catch (err) {
    console.error('Could not save notification:', err.message);
  }
}

module.exports = { notify };
