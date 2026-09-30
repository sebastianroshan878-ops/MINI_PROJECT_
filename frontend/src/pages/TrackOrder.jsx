import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { usePolling } from '../hooks/usePolling.js';
import OrderTimeline from '../components/OrderTimeline.jsx';
import PaymentModal from '../components/PaymentModal.jsx';
import Badge from '../components/Badge.jsx';
import { money, TYPE_LABEL, dateTime } from '../utils.js';

export default function TrackOrder() {
  const [params] = useSearchParams();
  const [orderNumber, setOrderNumber] = useState(params.get('order') || '');
  const [phone, setPhone] = useState(params.get('phone') || '');
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [searched, setSearched] = useState(false);

  async function find(e) {
    if (e) e.preventDefault();
    setError('');
    setLoading(true);
    setSearched(true);
    try {
      setOrder(await api.get(`/orders/track/${orderNumber.trim().toUpperCase()}?phone=${phone.trim()}`));
    } catch (err) {
      setOrder(null);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (params.get('order') && params.get('phone')) find();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  usePolling(() => {
    if (order && !['completed', 'cancelled'].includes(order.status)) find();
  }, 15000, [order && order.status]);

  return (
    <div className="container page narrow">
      <h1>Track Your Order</h1>
      <form onSubmit={find} className="form-grid">
        <div className="field"><label htmlFor="on">Order number</label><input id="on" placeholder="ORD-123456" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} required /></div>
        <div className="field"><label htmlFor="ph">Phone number</label><input id="ph" inputMode="numeric" maxLength={10} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} required /></div>
        <button className="btn btn-primary" style={{ alignSelf: 'end' }} disabled={loading}>{loading ? 'Searching...' : 'Track'}</button>
      </form>

      {error && <div className="alert alert-red">{error}</div>}

      {order && (
        <div className="track-card">
          <div className="spread">
            <div>
              <h2>{order.orderNumber}</h2>
              <p className="muted">{TYPE_LABEL[order.type]} • Placed {dateTime(order.createdAt)}</p>
            </div>
            <Badge status={order.status} />
          </div>

          <OrderTimeline order={order} />

          <ul className="order-items">
            {order.items.map((item, i) => (
              <li key={i}><span>{item.quantity} × {item.name}</span><span>{money(item.lineTotal)}</span></li>
            ))}
          </ul>
          <div className="spread grand"><span>Total</span><span>{money(order.total)}</span></div>

          {order.assignedTo && <p className="muted">Delivery partner: {order.assignedTo.name}</p>}

          {order.paymentStatus === 'unpaid' && order.status !== 'cancelled' && (
            <button className="btn btn-primary btn-block" onClick={() => setPayOpen(true)}>Pay {money(order.total)} online</button>
          )}
          {order.paymentStatus === 'paid' && <p className="alert alert-green">Paid ✓</p>}
        </div>
      )}

      {searched && !order && !loading && !error && <p className="muted">No order found.</p>}
      {payOpen && order && <PaymentModal order={order} onClose={() => setPayOpen(false)} onPaid={() => { setPayOpen(false); find(); }} />}
    </div>
  );
}
