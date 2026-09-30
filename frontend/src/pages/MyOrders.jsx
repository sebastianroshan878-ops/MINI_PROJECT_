import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import Badge from '../components/Badge.jsx';
import Modal from '../components/Modal.jsx';
import PaymentModal from '../components/PaymentModal.jsx';
import { money, dateTime, TYPE_LABEL } from '../utils.js';

export default function MyOrders() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payingOrder, setPayingOrder] = useState(null);
  const [cancellingOrder, setCancellingOrder] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);

  function loadOrders() {
    setLoading(true);
    let local = [];
    try {
      local = JSON.parse(localStorage.getItem('lumora_orders') || '[]');
    } catch {}

    api.get('/orders/mine')
      .then((serverOrders) => {
        if (Array.isArray(serverOrders)) {
          const map = new Map();
          serverOrders.forEach((o) => map.set(o.orderNumber, o));
          local.forEach((o) => {
            if (!map.has(o.orderNumber)) map.set(o.orderNumber, o);
          });
          setOrders([...map.values()]);
        } else {
          setOrders(local);
        }
      })
      .catch(() => {
        setOrders(local);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadOrders();
  }, [user]);

  async function handleConfirmCancel() {
    if (!cancellingOrder) return;
    setIsSubmittingCancel(true);
    const targetId = cancellingOrder._id || cancellingOrder.orderNumber;
    const reasonText = cancelReason.trim() || 'Cancelled by customer';

    try {
      await api.post(`/orders/${targetId}/cancel`, { reason: reasonText });

      // Update in state
      setOrders((prev) =>
        prev.map((o) =>
          o.orderNumber === cancellingOrder.orderNumber
            ? { ...o, status: 'cancelled', cancelReason: reasonText, cancelledAt: new Date().toISOString() }
            : o
        )
      );

      // Update in localStorage
      try {
        const local = JSON.parse(localStorage.getItem('lumora_orders') || '[]');
        const updatedLocal = local.map((o) =>
          o.orderNumber === cancellingOrder.orderNumber
            ? { ...o, status: 'cancelled', cancelReason: reasonText, cancelledAt: new Date().toISOString() }
            : o
        );
        localStorage.setItem('lumora_orders', JSON.stringify(updatedLocal));
      } catch {}

      toast(`Order #${cancellingOrder.orderNumber} has been cancelled successfully.`, 'success');
      setCancellingOrder(null);
      setCancelReason('');
    } catch (err) {
      toast(err.message || 'Could not cancel order', 'error');
    } finally {
      setIsSubmittingCancel(false);
    }
  }

  return (
    <div className="container page narrow">
      <div className="spread" style={{ marginBottom: '20px' }}>
        <div>
          <h1>My Orders</h1>
          <p className="muted">View your dining orders, linked table reservations, and live preparation status.</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => navigate('/menu')}>
          + Order More Food
        </button>
      </div>

      {loading && <p className="muted center-text">Loading orders...</p>}

      {!loading && orders.length === 0 && (
        <div className="empty-state-card">
          <span style={{ fontSize: '2.5rem' }}>🧾</span>
          <h3>No Orders Placed Yet</h3>
          <p className="muted">You haven't placed any orders yet. Browse our delicious dishes or reserve a table to get started.</p>
          <div className="spread" style={{ marginTop: '12px' }}>
            <button className="btn btn-primary" onClick={() => navigate('/menu')}>
              Browse Menu
            </button>
            <button className="btn btn-ghost" onClick={() => navigate('/reservations')}>
              Reserve a Table
            </button>
          </div>
        </div>
      )}

      <div className="stack" style={{ gap: '16px' }}>
        {orders.map((o) => {
          const tableNum = o.table?.number || o.tableNumber || (o.reservation && o.reservation.tableNumber);
          const resInfo = o.reservation;
          const resCode = typeof resInfo === 'string' ? resInfo : resInfo?.code;
          const resStatus = resInfo?.status || 'Confirmed';
          const canCancel = ['placed', 'confirmed', 'preparing'].includes(o.status);
          const isCancelled = o.status === 'cancelled';

          return (
            <div key={o._id || o.orderNumber} className="list-card order-history-card">
              {/* Card Header: Order # & Status Badge */}
              <div className="spread" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '10px', marginBottom: '12px' }}>
                <div>
                  <strong style={{ fontSize: '1.2rem', color: 'var(--text)' }}>
                    Order #{o.orderNumber}
                  </strong>
                  <span className="muted small" style={{ display: 'block', marginTop: '2px' }}>
                    {TYPE_LABEL[o.type] || o.type} • {dateTime(o.createdAt || new Date())}
                  </span>
                </div>
                <Badge status={o.status || 'preparing'} />
              </div>

              {/* Table & Reservation Highlight Block */}
              {(tableNum || resCode) && (
                <div
                  style={{
                    background: '#f0f7ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.2rem' }}>🍽️</span>
                    <div>
                      {tableNum && (
                        <strong style={{ color: '#1e40af' }}>
                          Table {tableNum < 10 ? `0${tableNum}` : tableNum}
                        </strong>
                      )}
                      {resCode && (
                        <span className="muted small" style={{ marginLeft: '8px' }}>
                          Reservation: <strong>{resCode}</strong> ({resStatus})
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="badge tone-blue">Dine-in Linked</span>
                </div>
              )}

              {/* Cancellation Notice if Cancelled */}
              {isCancelled && (
                <div
                  style={{
                    background: '#fff1f2',
                    border: '1px solid #fecdd3',
                    color: '#9f1239',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    fontSize: '0.88rem',
                    marginBottom: '12px',
                  }}
                >
                  <strong>🚫 Order Cancelled:</strong> {o.cancelReason || 'Cancelled by customer'}
                </div>
              )}

              {/* Itemized List */}
              <div style={{ marginBottom: '12px' }}>
                <small className="muted" style={{ display: 'block', marginBottom: '4px' }}>Items:</small>
                <div style={{ fontSize: '0.92rem', color: 'var(--text)' }}>
                  {(o.items || []).map((it, idx) => (
                    <span key={idx}>
                      <strong>{it.name || it.menuItem?.name || 'Dish'}</strong> × {it.quantity || 1}
                      {idx < o.items.length - 1 ? ', ' : ''}
                    </span>
                  ))}
                </div>
              </div>

              {/* Card Footer: Total & Actions */}
              <div className="spread" style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                <div>
                  <small className="muted" style={{ display: 'block' }}>Total Amount</small>
                  <strong style={{ fontSize: '1.2rem', color: isCancelled ? '#94a3b8' : 'var(--primary)', textDecoration: isCancelled ? 'line-through' : 'none' }}>
                    {money(o.total)}
                  </strong>
                </div>

                <div className="row-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {!isCancelled && (
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      onClick={() => navigate(`/track?order=${o.orderNumber}&phone=${o.customerPhone || ''}`)}
                    >
                      📍 Live Status
                    </button>
                  )}

                  {!isCancelled && o.paymentStatus !== 'paid' && (
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={() => setPayingOrder(o)}
                    >
                      💳 Pay Now
                    </button>
                  )}

                  {canCancel && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{
                        background: '#ffffff',
                        border: '1px solid #fca5a5',
                        color: '#dc2626',
                        cursor: 'pointer',
                      }}
                      onClick={() => {
                        setCancellingOrder(o);
                        setCancelReason('');
                      }}
                    >
                      Cancel Order
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Cancel Order Confirmation Modal */}
      {cancellingOrder && (
        <Modal
          title={`Cancel Order #${cancellingOrder.orderNumber}`}
          onClose={() => setCancellingOrder(null)}
        >
          <div className="stack" style={{ gap: '14px' }}>
            <p>
              Are you sure you want to cancel <strong>Order #{cancellingOrder.orderNumber}</strong>?
            </p>
            <p className="small muted">
              The kitchen will immediately halt preparation and the status will be updated to <em>Cancelled</em>.
            </p>

            <div className="field">
              <label>Reason for cancellation (optional)</label>
              <textarea
                rows={2}
                placeholder="e.g. Change of plans, Ordered wrong items..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
            </div>

            <div className="spread" style={{ marginTop: '10px' }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setCancellingOrder(null)}
                disabled={isSubmittingCancel}
              >
                Keep Order
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ background: '#dc2626', borderColor: '#dc2626', color: '#fff' }}
                onClick={handleConfirmCancel}
                disabled={isSubmittingCancel}
              >
                {isSubmittingCancel ? 'Cancelling...' : 'Yes, Cancel Order'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {payingOrder && (
        <PaymentModal
          order={payingOrder}
          onClose={() => setPayingOrder(null)}
          onPaid={() => {
            setPayingOrder(null);
            loadOrders();
          }}
        />
      )}
    </div>
  );
}
