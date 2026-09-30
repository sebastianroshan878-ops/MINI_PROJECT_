const path = require('path');

// In local environment, attempt to read backend/.env if available
try {
  require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });
} catch (e) {
  // On Vercel, env vars are injected by Vercel platform into process.env
}

const app = require('../backend/server');
const connectDB = require('../backend/config/db');

let adminChecked = false;

module.exports = async (req, res) => {
  try {
    const connected = await connectDB({ exitOnError: false, timeoutMs: 8000 });
    if (connected && !adminChecked && typeof app.ensureAdmin === 'function') {
      await app.ensureAdmin().catch((err) => {
        console.warn('ensureAdmin error in serverless:', err.message);
      });
      adminChecked = true;
    }
  } catch (err) {
    console.error('Serverless database connection error:', err.message);
  }

  return app(req, res);
};
