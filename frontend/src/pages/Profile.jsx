import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { StarInput, Stars } from '../components/Stars.jsx';
import Badge from '../components/Badge.jsx';
import Modal from '../components/Modal.jsx';
import { money, dateTime, TYPE_LABEL, SEATING_LABEL, prettyStatus } from '../utils.js';

function TabButton({ id, active, setActive, children }) {
  return <button className={`tab ${active === id ? 'active' : ''}`} onClick={() => setActive(id)}>{children}</button>;
}

function ReviewModal({ order, onClose, onDone }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function submit() {
    setBusy(true);
    try {
      await api.post('/feedback', { orderId: order._id, rating, comment });
      toast('Thanks for the feedback!', 'success');
      onDone();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Rate order ${order.orderNumber}`} onClose={onClose}>
      <div className="center-text">
        <StarInput value={rating} onChange={setRating} />
      </div>
      <div className="field"><label htmlFor="c">Comment (optional)</label><textarea id="c" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} /></div>
      <button className="btn btn-primary btn-block" onClick={submit} disabled={busy}>{busy ? 'Sending...' : 'Submit review'}</button>
    </Modal>
  );
}

export default function Profile() {
  const { customer, refreshCustomer } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('orders');
  const [orders, setOrders] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [reviewOrder, setReviewOrder] = useState(null);
  const [form, setForm] = useState(customer);

  const load = () => {
    api.get('/orders/mine').then(setOrders);
    api.get('/reservations/mine').then(setReservations);
    api.get('/feedback/mine').then(setFeedback);
  };
  useEffect(load, []);
  useEffect(() => setForm(customer), [customer]);

  async function saveProfile(e) {
    e.preventDefault();
    try {
      await api.put('/customers/me', form);
      await refreshCustomer();
      toast('Profile updated', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function cancelReservation(id) {
    if (!confirm('Cancel this reservation?')) return;
    await api.post(`/reservations/${id}/cancel`);
    load();
  }
  async function cancelOrder(id) {
    const reason = prompt('Why are you cancelling this order?', 'Changed my mind');
    if (reason === null) return;
    try {
      await api.post(`/orders/${id}/cancel`, { reason });
      load();
      toast('Order cancelled', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  if (!form) return null;

  return (
    <div className="container page">
      <h1>Hi, {customer.name.split(' ')[0]} 👋</h1>
      <div className="loyalty-strip">
        <div><strong>{customer.tierInfo.name} tier</strong><span className="muted">Bonus x{customer.tierInfo.multiplier}</span></div>
        <div><strong>{customer.loyaltyPoints}</strong><span className="muted">points available</span></div>
        <div><strong>{money(customer.totalSpent)}</strong><span className="muted">lifetime spend</span></div>
        {customer.tierInfo.next && <div className="muted small">{customer.tierInfo.next.pointsNeeded} points to {customer.tierInfo.next.name}</div>}
      </div>

      <div className="tabs">
        <TabButton id="orders" active={tab} setActive={setTab}>Orders</TabButton>
        <TabButton id="reservations" active={tab} setActive={setTab}>Reservations</TabButton>
        <TabButton id="reviews" active={tab} setActive={setTab}>My reviews</TabButton>
        <TabButton id="settings" active={tab} setActive={setTab}>Profile & preferences</TabButton>
      </div>

      {tab === 'orders' && (
        <div className="stack">
          {orders.length === 0 && <p className="muted">No orders yet.</p>}
          {orders.map((o) => (
            <div key={o._id} className="list-card">
              <div className="spread">
                <div><strong>{o.orderNumber}</strong> <span className="muted">{TYPE_LABEL[o.type]} • {dateTime(o.createdAt)}</span></div>
                <Badge status={o.status} />
              </div>
              <p className="muted small">{o.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}</p>
              <div className="spread">
                <strong>{money(o.total)}</strong>
                <div className="row-actions">
                  {['placed', 'confirmed'].includes(o.status) && <button className="link-btn danger" onClick={() => cancelOrder(o._id)}>Cancel</button>}
                  {o.status === 'completed' && !feedback.some((f) => f.order === o._id) && <button className="link-btn" onClick={() => setReviewOrder(o)}>Rate order</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'reservations' && (
        <div className="stack">
          {reservations.length === 0 && <p className="muted">No reservations yet.</p>}
          {reservations.map((r) => (
            <div key={r._id} className="list-card">
              <div className="spread">
                <div><strong>{r.code}</strong> <span className="muted">{new Date(r.startAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span></div>
                <Badge status={r.status} />
              </div>
              <p className="muted small">Table {r.table.number} • {r.guests} guests • {SEATING_LABEL[r.seatingPreference]}</p>
              {r.status === 'confirmed' && <button className="link-btn danger" onClick={() => cancelReservation(r._id)}>Cancel reservation</button>}
            </div>
          ))}
        </div>
      )}

      {tab === 'reviews' && (
        <div className="stack">
          {feedback.length === 0 && <p className="muted">You haven't left any reviews yet.</p>}
          {feedback.map((f) => (
            <div key={f._id} className="list-card">
              <div className="spread"><Stars value={f.rating} /><span className="muted small">{dateTime(f.createdAt)}</span></div>
              <p>{f.comment}</p>
              {f.reply && <p className="reply">Restaurant replied: {f.reply}</p>}
            </div>
          ))}
        </div>
      )}

      {tab === 'settings' && (
        <form onSubmit={saveProfile} className="stack narrow-form">
          <div className="form-grid">
            <div className="field"><label>Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="field"><label>Email</label><input type="email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          </div>
          <div className="field"><label>Default delivery address</label><textarea rows={2} value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div className="form-grid">
            <div className="field"><label>Seating preference</label>
              <select value={form.preferences.seating} onChange={(e) => setForm({ ...form, preferences: { ...form.preferences, seating: e.target.value } })}>
                {Object.entries(SEATING_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="field"><label>Diet</label>
              <select value={form.preferences.diet} onChange={(e) => setForm({ ...form, preferences: { ...form.preferences, diet: e.target.value } })}>
                <option value="any">Any</option><option value="veg">Vegetarian</option><option value="non-veg">Non-vegetarian</option><option value="vegan">Vegan</option>
              </select>
            </div>
            <div className="field"><label>Spice level</label>
              <select value={form.preferences.spiceLevel} onChange={(e) => setForm({ ...form, preferences: { ...form.preferences, spiceLevel: e.target.value } })}>
                <option value="mild">Mild</option><option value="medium">Medium</option><option value="hot">Hot</option>
              </select>
            </div>
            <div className="field"><label>Usual order type</label>
              <select value={form.preferences.orderType} onChange={(e) => setForm({ ...form, preferences: { ...form.preferences, orderType: e.target.value } })}>
                <option value="delivery">Home delivery</option><option value="parcel">Takeaway parcel</option>
              </select>
            </div>
          </div>
          <button className="btn btn-primary" style={{ alignSelf: 'start' }}>Save changes</button>
        </form>
      )}

      {reviewOrder && <ReviewModal order={reviewOrder} onClose={() => setReviewOrder(null)} onDone={() => { setReviewOrder(null); load(); }} />}
    </div>
  );
}
