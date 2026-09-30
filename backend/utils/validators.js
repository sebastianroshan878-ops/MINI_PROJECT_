// Simple input checks (the same rules are repeated on the React forms).
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim());
const isPhone = (v) => /^\d{10}$/.test(String(v || '').trim());
const isTime = (v) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v || ''));
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));

// Luhn algorithm: the standard checksum used by card numbers
function passesLuhn(number) {
  const digits = String(number).replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

module.exports = { isEmail, isPhone, isTime, isDate, passesLuhn };
