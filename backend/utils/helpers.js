// Small helper functions used in many places.

// An error that carries an HTTP status code. The error handler turns it into a JSON reply.
class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const pad = (n) => String(n).padStart(2, '0');

// Codes like RSV-483920 or ORD-120394
function makeCode(prefix) {
  return `${prefix}-${Math.floor(100000 + Math.random() * 900000)}`;
}

// Date -> "2026-09-25"
function toDateStr(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Date -> "19:30"
function toHHmm(d) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ("2026-09-25", "19:30") -> Date
function buildDate(dateStr, timeStr) {
  return new Date(`${dateStr}T${timeStr}:00`);
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function minutesBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 60000);
}

function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Copy only the allowed keys from an object (stops users from sending fields they should not)
function pick(obj, keys) {
  const out = {};
  keys.forEach((k) => {
    if (obj[k] !== undefined) out[k] = obj[k];
  });
  return out;
}

module.exports = {
  HttpError, round2, makeCode, toDateStr, toHHmm, buildDate,
  startOfDay, endOfDay, minutesBetween, escapeRegex, pick,
};
