export const money = (n) => {
  const value = Number(n || 0);
  return '₹' + value.toLocaleString('en-IN', { minimumFractionDigits: value % 1 ? 2 : 0, maximumFractionDigits: 2 });
};

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export const dateTime = (d) =>
  new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
export const dateOnly = (d) => new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
export const timeOnly = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

const pad = (n) => String(n).padStart(2, '0');
export const toDateStr = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const addDays = (days) => new Date(Date.now() + days * 86400000);

// "19:30" -> "7:30 PM"
export function niceTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${((h + 11) % 12) + 1}:${pad(m)} ${suffix}`;
}

// ("11:00", "21:30", 30) -> ["11:00", "11:30", ...]
export function timeSlots(from, to, step = 30) {
  const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  const slots = [];
  for (let m = toMin(from); m <= toMin(to); m += step) slots.push(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`);
  return slots;
}

export const isPhone = (v) => /^\d{10}$/.test(String(v || '').trim());
export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim());

export const TYPE_LABEL = { 'dine-in': 'Dine-in', parcel: 'Takeaway parcel', delivery: 'Home delivery' };
export const SEATING_LABEL = {
  'no-preference': 'No preference',
  indoor: 'Indoor',
  outdoor: 'Outdoor',
  window: 'Window side',
  'quiet-corner': 'Quiet corner',
};
export const METHOD_LABEL = { card: 'Card', upi: 'UPI', wallet: 'Wallet', cash: 'Cash' };

// Which badge colour belongs to which status word
const TONES = {
  placed: 'blue', confirmed: 'blue', preparing: 'amber', ready: 'green', 'out-for-delivery': 'amber', completed: 'green', cancelled: 'red',
  available: 'green', occupied: 'red', cleaning: 'amber', reserved: 'blue', seated: 'blue', 'no-show': 'red',
  waiting: 'amber', promoted: 'green', paid: 'green', unpaid: 'amber', refunded: 'grey', success: 'green', failed: 'red',
  pending: 'grey', 'in-progress': 'amber', done: 'green',
};
export const statusTone = (status) => TONES[status] || 'grey';
export const prettyStatus = (s) => String(s).replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
