// A SIMULATED payment gateway (test mode) so the project works without a real merchant account.
// It behaves like a real one: it validates the details, talks "to the bank" and returns a result.
// To use a real gateway (e.g. Razorpay test keys) you only need to replace the charge() function.
const { HttpError } = require('../utils/helpers');
const { passesLuhn } = require('../utils/validators');

const WALLETS = ['Paytm', 'PhonePe', 'Amazon Pay', 'Google Pay'];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function cardBrand(number) {
  if (/^4/.test(number)) return 'Visa';
  if (/^5[1-5]/.test(number)) return 'Mastercard';
  if (/^3[47]/.test(number)) return 'Amex';
  if (/^(60|65|81|82)/.test(number)) return 'RuPay';
  return 'Card';
}

async function charge({ method, details }) {
  await sleep(700); // pretend to wait for the bank
  const transactionId = `TXN${Date.now()}${Math.floor(100 + Math.random() * 900)}`;

  if (method === 'card') {
    const number = String(details.cardNumber || '').replace(/\s+/g, '');
    if (!/^\d+$/.test(number) || !passesLuhn(number)) throw new HttpError(400, 'Card number is not valid');
    if (!String(details.cardName || '').trim()) throw new HttpError(400, 'Enter the name on the card');

    const match = /^(\d{2})\/(\d{2})$/.exec(String(details.expiry || ''));
    if (!match) throw new HttpError(400, 'Enter the expiry date as MM/YY');
    const month = Number(match[1]);
    const year = 2000 + Number(match[2]);
    if (month < 1 || month > 12) throw new HttpError(400, 'Expiry month must be between 01 and 12');
    if (new Date(year, month, 0, 23, 59, 59) < new Date()) throw new HttpError(400, 'This card has expired');
    if (!/^\d{3,4}$/.test(String(details.cvv || ''))) throw new HttpError(400, 'CVV must be 3 or 4 digits');

    // Only the brand and last 4 digits are kept. The full number and CVV are thrown away.
    const maskedDetails = { cardBrand: cardBrand(number), cardLast4: number.slice(-4) };
    if (number.endsWith('0002')) {
      return { success: false, transactionId, message: 'The bank declined this card (test card ending 0002)', maskedDetails };
    }
    return { success: true, transactionId, message: 'Payment successful', maskedDetails };
  }

  if (method === 'upi') {
    const upiId = String(details.upiId || '').trim().toLowerCase();
    if (!/^[a-z0-9._-]{2,}@[a-z]{2,}$/.test(upiId)) throw new HttpError(400, 'Enter a valid UPI ID, for example name@upi');
    const maskedDetails = { upiId: upiId.replace(/^(.{2}).*(@.*)$/, '$1***$2') };
    if (upiId.startsWith('fail')) {
      return { success: false, transactionId, message: 'The UPI request was declined (test ID starting with "fail")', maskedDetails };
    }
    return { success: true, transactionId, message: 'Payment successful', maskedDetails };
  }

  if (method === 'wallet') {
    if (!WALLETS.includes(details.walletName)) throw new HttpError(400, 'Choose a wallet');
    if (!/^\d{10}$/.test(String(details.mobile || ''))) throw new HttpError(400, 'Enter the 10 digit mobile number linked to your wallet');
    return { success: true, transactionId, message: 'Payment successful', maskedDetails: { walletName: details.walletName } };
  }

  throw new HttpError(400, 'Unsupported payment method');
}

module.exports = { charge, WALLETS };
