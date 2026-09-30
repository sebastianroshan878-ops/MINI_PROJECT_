import { useState } from 'react';
import Modal from './Modal.jsx';
import { api } from '../api.js';
import { money, METHOD_LABEL } from '../utils.js';

const WALLETS = ['Paytm', 'PhonePe', 'Amazon Pay', 'Google Pay'];

// Payment window: card / UPI / wallet (online gateway) and cash (staff only).
export default function PaymentModal({ order, staff = false, onClose, onPaid }) {
  const methods = staff ? ['card', 'upi', 'wallet', 'cash'] : ['card', 'upi', 'wallet'];
  const [method, setMethod] = useState('card');
  const [card, setCard] = useState({ cardNumber: '', cardName: '', expiry: '', cvv: '' });
  const [upiId, setUpiId] = useState('');
  const [wallet, setWallet] = useState({ walletName: WALLETS[0], mobile: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const setCardField = (field, value) => setCard((c) => ({ ...c, [field]: value }));

  // 4111111111111111 -> "4111 1111 1111 1111"
  const formatNumber = (v) => v.replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim();
  // 0932 -> "09/32"
  const formatExpiry = (v) => {
    const digits = v.replace(/\D/g, '').slice(0, 4);
    return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
  };

  async function submit(e) {
    e.preventDefault();
    setError('');
    let details = {};
    if (method === 'card') details = card;
    if (method === 'upi') details = { upiId };
    if (method === 'wallet') details = wallet;

    setBusy(true);
    try {
      const result = await api.post('/payments/pay', { orderId: order._id, method, details });
      onPaid(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Pay ${money(order.total)}`} onClose={onClose}>
      <p className="muted">Order {order.orderNumber}</p>
      <div className="tabs" role="tablist">
        {methods.map((m) => (
          <button key={m} type="button" className={`tab ${method === m ? 'active' : ''}`} onClick={() => { setMethod(m); setError(''); }}>
            {METHOD_LABEL[m]}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="stack">
        {method === 'card' && (
          <>
            <div className="field">
              <label htmlFor="cardNumber">Card number</label>
              <input id="cardNumber" inputMode="numeric" autoComplete="off" placeholder="4111 1111 1111 1111"
                value={card.cardNumber} onChange={(e) => setCardField('cardNumber', formatNumber(e.target.value))} />
            </div>
            <div className="field">
              <label htmlFor="cardName">Name on card</label>
              <input id="cardName" value={card.cardName} onChange={(e) => setCardField('cardName', e.target.value)} />
            </div>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="expiry">Expiry (MM/YY)</label>
                <input id="expiry" inputMode="numeric" placeholder="12/30" value={card.expiry}
                  onChange={(e) => setCardField('expiry', formatExpiry(e.target.value))} />
              </div>
              <div className="field">
                <label htmlFor="cvv">CVV</label>
                <input id="cvv" type="password" inputMode="numeric" maxLength={4} autoComplete="off" value={card.cvv}
                  onChange={(e) => setCardField('cvv', e.target.value.replace(/\D/g, ''))} />
              </div>
            </div>
            <p className="hint">Test mode. Use card 4111 1111 1111 1111 with any future expiry and CVV. Card 4000 0000 0000 0002 is always declined.</p>
          </>
        )}

        {method === 'upi' && (
          <div className="field">
            <label htmlFor="upi">UPI ID</label>
            <input id="upi" placeholder="name@upi" value={upiId} onChange={(e) => setUpiId(e.target.value)} />
            <p className="hint">Test mode. Any valid ID such as anjali@upi works. IDs starting with "fail" are declined.</p>
          </div>
        )}

        {method === 'wallet' && (
          <>
            <div className="field">
              <label htmlFor="wallet">Wallet</label>
              <select id="wallet" value={wallet.walletName} onChange={(e) => setWallet({ ...wallet, walletName: e.target.value })}>
                {WALLETS.map((w) => <option key={w}>{w}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="mobile">Mobile number linked to the wallet</label>
              <input id="mobile" inputMode="numeric" maxLength={10} value={wallet.mobile}
                onChange={(e) => setWallet({ ...wallet, mobile: e.target.value.replace(/\D/g, '') })} />
            </div>
          </>
        )}

        {method === 'cash' && <p>Collect {money(order.total)} in cash from the guest, then confirm.</p>}

        {error && <div className="alert alert-red" role="alert">{error}</div>}

        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Processing...' : method === 'cash' ? 'Confirm cash received' : `Pay ${money(order.total)}`}
        </button>
        <p className="hint center">🔒 Card numbers and CVV are checked and then discarded. They are never saved.</p>
      </form>
    </Modal>
  );
}
