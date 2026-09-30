import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { usePolling } from '../../hooks/usePolling.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import Badge from '../../components/Badge.jsx';
import Modal from '../../components/Modal.jsx';
import BillView from '../../components/BillView.jsx';
import PaymentModal from '../../components/PaymentModal.jsx';
import { money, dateTime, TYPE_LABEL, prettyStatus } from '../../utils.js';

const NEXT_STATUS = { placed: 'confirmed', confirmed: 'preparing', preparing: 'ready', ready: 'out-for-delivery', 'out-for-delivery': 'completed' };
const ROLE_CAN_ADVANCE = { admin: true, manager: true, waiter: ['confirmed', 'preparing', 'ready', 'completed'], chef: ['confirmed', 'preparing', 'ready'], delivery: ['out-for-delivery', 'completed'] };

function nextStepFor(order, role) {
  const flow = { 'dine-in': ['placed', 'confirmed', 'preparing', 'ready', 'completed'], parcel: ['placed', 'confirmed', 'preparing', 'ready', 'completed'], delivery: ['placed', 'confirmed', 'preparing', 'ready', 'out-for-delivery', 'completed'] }[order.type];
  const idx = flow.indexOf(order.status);
  const next = flow[idx + 1];
  if (!next) return null;
  const allowed = ROLE_CAN_ADVANCE[role];
  if (allowed === true) return next;
  if (Array.isArray(allowed) && allowed.includes(next)) return next;
  return null;
}

function BillModal({ order, onClose }) {
  const [bill, setBill] = useState(null);
  useEffect(() => { api.get(`/orders/${order._id}/bill`).then(setBill); }, [order._id]);
  return (
    <Modal title="Bill" onClose={onClose} wide>
      {bill ? <BillView bill={bill} /> : <p className="muted">Loading bill...</p>}
      {bill && <button className="btn btn-ghost btn-block" onClick={() => window.print()}>🖨️ Print</button>}
    </Modal>
  );
}

export default function Orders() {
  const { user } = useAuth();
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [search, setSearch] = useState('');
  const [orders, setOrders] = useState([]);
  const [billFor, setBillFor] = useState(null);
  const [payFor, setPayFor] = useState(null);

  const load = () => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (type) params.set('type', type);
    if (search.trim()) params.set('search', search.trim());
    api.get(`/orders?${params}`).then(setOrders);
  };
  usePolling(load, 12000, [status, type, search]);

  async function advance(order) {
    const next = nextStepFor(order, user.role);
    if (!next) return;
    try {
      await api.patch(`/orders/${order._id}/status`, { status: next });
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function assignToMe(order) {
    await api.patch(`/orders/${order._id}/assign`, { userId: 'me' });
    load();
  }

  async function cancelOrder(order) {
    const reason = prompt('Reason for cancelling this order?', 'Customer requested');
    if (reason === null) return;
    try {
      await api.post(`/orders/${order._id}/cancel`, { reason });
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  const [activeTab, setActiveTab] = useState('all'); // 'all', 'active', 'completed', 'cancelled'

  const displayedOrders = orders.filter((o) => {
    if (activeTab === 'active') return ['placed', 'confirmed', 'preparing', 'ready', 'out-for-delivery'].includes(o.status);
    if (activeTab === 'completed') return o.status === 'completed';
    if (activeTab === 'cancelled') return o.status === 'cancelled';
    return true;
  });

  return (
    <div className="stack">
      <div className="spread">
        <h1>Orders</h1>
        <div className="chip-row">
          <button
            type="button"
            className={`chip ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            All Orders ({orders.length})
          </button>
          <button
            type="button"
            className={`chip ${activeTab === 'active' ? 'active' : ''}`}
            onClick={() => setActiveTab('active')}
          >
            Active Orders ({orders.filter((o) => ['placed', 'confirmed', 'preparing', 'ready', 'out-for-delivery'].includes(o.status)).length})
          </button>
          <button
            type="button"
            className={`chip ${activeTab === 'completed' ? 'active' : ''}`}
            onClick={() => setActiveTab('completed')}
          >
            Completed ({orders.filter((o) => o.status === 'completed').length})
          </button>
          <button
            type="button"
            className={`chip ${activeTab === 'cancelled' ? 'active' : ''}`}
            onClick={() => setActiveTab('cancelled')}
          >
            Cancelled ({orders.filter((o) => o.status === 'cancelled').length})
          </button>
        </div>
      </div>

      <div className="form-grid">
        <input placeholder="Search order # or name" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option><option value="dine-in">Dine-in</option><option value="parcel">Parcel</option><option value="delivery">Delivery</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {['placed', 'confirmed', 'preparing', 'ready', 'out-for-delivery', 'completed', 'cancelled'].map((s) => <option key={s} value={s}>{prettyStatus(s)}</option>)}
        </select>
      </div>

      <div className="grid grid-3">
        {displayedOrders.map((o) => {
          const next = nextStepFor(o, user.role);
          return (
            <div key={o._id} className="order-card">
              <div className="spread">
                <strong>{o.orderNumber}</strong>
                <Badge status={o.status} />
              </div>
              <p className="muted small">{TYPE_LABEL[o.type]}{o.table ? ` • Table ${o.table.number}` : ''} • {dateTime(o.createdAt)}</p>
              <p className="muted small">{o.customerName}{o.customerPhone ? ` • ${o.customerPhone}` : ''}</p>
              <ul className="order-items compact">
                {o.items.map((it, i) => <li key={i}><span>{it.quantity}× {it.name}{it.spiceLevel ? ` (${it.spiceLevel})` : ''}</span></li>)}
              </ul>
              <div className="spread">
                <strong>{money(o.total)}</strong>
                <Badge status={o.paymentStatus} />
              </div>
              {o.assignedTo && <p className="muted small">🛵 {o.assignedTo.name}</p>}
              {o.notes && <p className="muted small">📝 {o.notes}</p>}

              {o.status === 'cancelled' && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '6px 8px', marginTop: '6px' }}>
                  <strong style={{ color: '#b91c1c', fontSize: '0.82rem' }}>Cancelled:</strong>
                  <span className="small muted" style={{ display: 'block' }}>Reason: {o.cancelReason || 'No reason specified'}</span>
                  {o.cancelledBy && <span className="small muted" style={{ display: 'block' }}>By: {o.cancelledBy}</span>}
                  {o.cancelledAt && <span className="small muted" style={{ display: 'block' }}>At: {dateTime(o.cancelledAt)}</span>}
                </div>
              )}

              <div className="row-actions wrap">
                {next && <button className="btn btn-sm btn-primary" onClick={() => advance(o)}>Mark {prettyStatus(next)}</button>}
                {o.type === 'delivery' && user.role === 'delivery' && !o.assignedTo && o.status === 'ready' && <button className="btn btn-sm btn-ghost" onClick={() => assignToMe(o)}>Take this delivery</button>}
                <button className="link-btn" onClick={() => setBillFor(o)}>Bill</button>
                {o.paymentStatus === 'unpaid' && ['admin', 'manager', 'waiter', 'delivery'].includes(user.role) && o.status !== 'cancelled' && (
                  <button className="link-btn" onClick={() => setPayFor(o)}>Collect payment</button>
                )}
                {!['completed', 'cancelled'].includes(o.status) && ['admin', 'manager', 'waiter'].includes(user.role) && (
                  <button className="link-btn danger" onClick={() => cancelOrder(o)}>Cancel</button>
                )}
              </div>
            </div>
          );
        })}
        {displayedOrders.length === 0 && <p className="muted">No orders match this filter.</p>}
      </div>

      {billFor && <BillModal order={billFor} onClose={() => setBillFor(null)} />}
      {payFor && <PaymentModal order={payFor} staff onClose={() => setPayFor(null)} onPaid={() => { setPayFor(null); load(); }} />}
    </div>
  );
}
