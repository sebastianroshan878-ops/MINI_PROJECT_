import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { useToast } from '../../context/ToastContext.jsx';
import Badge from '../../components/Badge.jsx';
import Modal from '../../components/Modal.jsx';
import { Stars } from '../../components/Stars.jsx';
import { money, dateTime, TYPE_LABEL } from '../../utils.js';

function CustomerDetail({ id, onClose }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [points, setPoints] = useState('');
  const [reason, setReason] = useState('');

  const load = () => api.get(`/customers/${id}`).then(setData);
  useEffect(load, [id]);

  async function givePoints(e) {
    e.preventDefault();
    const value = parseInt(points, 10);
    if (!value) return;
    try {
      await api.post(`/customers/${id}/points`, { points: value, reason });
      toast('Points updated', 'success');
      setPoints(''); setReason('');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  if (!data) return <Modal title="Customer" onClose={onClose}><p className="muted">Loading...</p></Modal>;
  const { customer, orders, reservations, feedback } = data;

  return (
    <Modal title={customer.name} onClose={onClose} wide>
      <div className="loyalty-strip small">
        <div><strong>{customer.tierInfo.name}</strong><span className="muted">tier</span></div>
        <div><strong>{customer.loyaltyPoints}</strong><span className="muted">points</span></div>
        <div><strong>{money(customer.totalSpent)}</strong><span className="muted">spent</span></div>
        <div><strong>{customer.phone}</strong><span className="muted">{customer.email || 'no email'}</span></div>
      </div>

      <form onSubmit={givePoints} className="form-grid">
        <input type="number" placeholder="+/- points" value={points} onChange={(e) => setPoints(e.target.value)} />
        <input placeholder="Reason (e.g. birthday)" value={reason} onChange={(e) => setReason(e.target.value)} />
        <button className="btn btn-sm btn-primary">Apply</button>
      </form>

      <h4>Recent orders</h4>
      <ul className="plain-list">
        {orders.map((o) => (
          <li key={o._id} className="spread small"><span>{o.orderNumber} • {TYPE_LABEL[o.type]}</span><span><Badge status={o.status} /> {money(o.total)}</span></li>
        ))}
        {orders.length === 0 && <li className="muted">No orders yet.</li>}
      </ul>

      <h4>Recent reservations</h4>
      <ul className="plain-list">
        {reservations.map((r) => (
          <li key={r._id} className="spread small"><span>{r.code} • {dateTime(r.startAt)}</span><Badge status={r.status} /></li>
        ))}
        {reservations.length === 0 && <li className="muted">No reservations yet.</li>}
      </ul>

      <h4>Feedback</h4>
      <ul className="plain-list">
        {feedback.map((f) => <li key={f._id}><Stars value={f.rating} /> {f.comment}</li>)}
        {feedback.length === 0 && <li className="muted">No feedback yet.</li>}
      </ul>
    </Modal>
  );
}

export default function Customers() {
  const [search, setSearch] = useState('');
  const [list, setList] = useState([]);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => api.get(`/customers?search=${encodeURIComponent(search)}`).then(setList), 250);
    return () => clearTimeout(timer);
  }, [search]);

  return (
    <div className="stack">
      <h1>Customers</h1>
      <input className="search-input" placeholder="Search by name, phone or email..." value={search} onChange={(e) => setSearch(e.target.value)} />

      <div className="table-scroll">
        <table className="data-table">
          <thead><tr><th>Name</th><th>Phone</th><th>Tier</th><th>Points</th><th>Total spent</th><th></th></tr></thead>
          <tbody>
            {list.map((c) => (
              <tr key={c._id}>
                <td>{c.name}</td><td>{c.phone}</td>
                <td><Badge tone="amber">{c.tierInfo.name}</Badge></td>
                <td>{c.loyaltyPoints}</td><td>{money(c.totalSpent)}</td>
                <td><button className="link-btn" onClick={() => setOpenId(c._id)}>View</button></td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={6} className="muted center-text">No customers found.</td></tr>}
          </tbody>
        </table>
      </div>

      {openId && <CustomerDetail id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}
