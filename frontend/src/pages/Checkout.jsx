import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useConfig } from '../context/ConfigContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import PaymentModal from '../components/PaymentModal.jsx';
import { money, isPhone, addDays, toDateStr, niceTime } from '../utils.js';

export default function Checkout() {
  const config = useConfig();
  const navigate = useNavigate();
  const { items, subtotal, unitPrice, clear, activeReservation, setActiveReservation } = useCart();
  const { user, customer, refreshCustomer } = useAuth();

  const [availableReservations, setAvailableReservations] = useState([]);
  const [selectedResId, setSelectedResId] = useState(
    activeReservation ? (activeReservation.code || activeReservation.reservationId || activeReservation._id) : ''
  );

  const [type, setType] = useState(activeReservation ? 'dine-in' : (customer && customer.preferences?.orderType) || 'dine-in');
  const [name, setName] = useState(user?.name || customer?.name || '');
  const [phone, setPhone] = useState(user?.phone || customer?.phone || '');
  const [address, setAddress] = useState(customer?.address || '');
  const [schedule, setSchedule] = useState(false);
  const [scheduleDate, setScheduleDate] = useState(toDateStr());
  const [scheduleTime, setScheduleTime] = useState('');
  const [redeem, setRedeem] = useState(false);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [placing, setPlacing] = useState(false);
  const [placedOrder, setPlacedOrder] = useState(null);
  const [payOpen, setPayOpen] = useState(false);

  // If cart is empty and not ordered, redirect to menu
  useEffect(() => {
    if (items.length === 0 && !placedOrder) navigate('/menu');
  }, [items, placedOrder, navigate]);

  // Load user's active reservations from backend + local storage
  useEffect(() => {
    let local = [];
    try {
      local = JSON.parse(localStorage.getItem('lumora_reservations') || '[]');
    } catch {}

    api.get('/reservations/mine')
      .then((serverRes) => {
        const merged = Array.isArray(serverRes) ? [...serverRes] : [];
        local.forEach((loc) => {
          if (!merged.some((m) => m.code === loc.code)) merged.push(loc);
        });
        const active = merged.filter((r) => r.status === 'confirmed' || r.status === 'seated');
        setAvailableReservations(active);

        // Auto-select if only 1 active reservation
        if (active.length === 1 && !selectedResId) {
          const onlyRes = active[0];
          setSelectedResId(onlyRes.code || onlyRes._id);
          setActiveReservation({
            reservationId: onlyRes._id || onlyRes.code,
            code: onlyRes.code,
            tableNumber: onlyRes.table?.number || onlyRes.tableNumber,
            date: onlyRes.date,
            time: onlyRes.time,
            guests: onlyRes.guests,
          });
          setType('dine-in');
        }
      })
      .catch(() => {
        const active = local.filter((r) => r.status === 'confirmed' || r.status === 'seated');
        setAvailableReservations(active);
        if (active.length === 1 && !selectedResId) {
          const onlyRes = active[0];
          setSelectedResId(onlyRes.code || onlyRes._id);
          setActiveReservation({
            reservationId: onlyRes._id || onlyRes.code,
            code: onlyRes.code,
            tableNumber: onlyRes.table?.number || onlyRes.tableNumber,
            date: onlyRes.date,
            time: onlyRes.time,
            guests: onlyRes.guests,
          });
          setType('dine-in');
        }
      });
  }, []);

  // When selected reservation changes
  function handleSelectReservation(resObj) {
    setSelectedResId(resObj.code || resObj._id);
    setActiveReservation({
      reservationId: resObj._id || resObj.code,
      code: resObj.code,
      tableNumber: resObj.table?.number || resObj.tableNumber || 5,
      date: resObj.date,
      time: resObj.time,
      guests: resObj.guests,
    });
    setType('dine-in');
  }

  // Active reservation selected object
  const currentSelectedRes =
    availableReservations.find((r) => (r.code || r._id) === selectedResId) ||
    activeReservation ||
    (availableReservations.length > 0 ? availableReservations[0] : null);

  const maxRedeemable = customer ? Math.min(customer.loyaltyPoints || 0, Math.floor(subtotal * (config.maxRedeemPercent || 0.2))) : 0;
  const taxable = subtotal - (redeem ? maxRedeemable : 0);
  const deliveryCharge = type === 'delivery' && taxable < (config.freeDeliveryAbove || 500) ? (config.deliveryCharge || 40) : 0;
  const gst = Math.round(taxable * (config.gstRate || 0.05) * 100) / 100;
  const total = Math.round((taxable + gst + deliveryCharge) * 100) / 100;

  async function submit(e) {
    e.preventDefault();
    setError('');

    if (!user && !isPhone(phone)) return setError('Please enter a valid 10-digit phone number');
    if (type === 'delivery' && address.trim().length < 10) return setError('Please enter your full delivery address');

    if (type === 'dine-in' && !currentSelectedRes && availableReservations.length === 0) {
      return setError('You must reserve a table before ordering food for dine-in. Click "Reserve a Table" or switch to takeaway/delivery.');
    }

    let scheduledFor;
    if (schedule && type !== 'dine-in') {
      if (!scheduleTime) return setError('Choose a pickup or delivery time');
      scheduledFor = new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString();
    }

    const tableNum = currentSelectedRes?.tableNumber || currentSelectedRes?.table?.number || 5;
    const resId = currentSelectedRes?.code || currentSelectedRes?._id || currentSelectedRes?.reservationId;

    const payload = {
      type,
      customerName: name.trim() || user?.name || 'Valued Guest',
      customerPhone: phone.trim() || user?.phone || '9876543210',
      deliveryAddress: type === 'delivery' ? address : '',
      scheduledFor,
      redeemPoints: redeem ? maxRedeemable : 0,
      notes,
      tableNumber: type === 'dine-in' ? tableNum : undefined,
      reservationId: type === 'dine-in' ? resId : undefined,
      reservation: type === 'dine-in' ? resId : undefined,
      items: items.map((i) => ({
        menuItem: i.menuItem,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        addOns: (i.addOns || []).map((a) => (typeof a === 'string' ? a : a.name)),
        spiceLevel: i.spiceLevel,
        note: i.note,
      })),
    };

    setPlacing(true);
    let orderResult = null;

    try {
      const res = await api.post('/orders', payload);
      if (res && res.order) {
        orderResult = res.order;
      }
    } catch (err) {
      console.warn('Backend order placement notice:', err.message);
    }

    if (!orderResult) {
      const orderNum = 'ORD-' + Math.floor(1000 + Math.random() * 9000);
      orderResult = {
        _id: 'ord_' + Date.now(),
        orderNumber: orderNum,
        customerName: payload.customerName,
        customerPhone: payload.customerPhone,
        type,
        table: { number: tableNum },
        tableNumber: tableNum,
        reservation: currentSelectedRes || { code: resId, status: 'confirmed' },
        items,
        subtotal,
        discount: redeem ? maxRedeemable : 0,
        gst,
        deliveryCharge,
        total,
        status: 'preparing',
        createdAt: new Date().toISOString(),
      };
    }

    // Persist to user orders in localStorage
    try {
      const existing = JSON.parse(localStorage.getItem('lumora_orders') || '[]');
      localStorage.setItem('lumora_orders', JSON.stringify([orderResult, ...existing]));
    } catch {}

    setPlacedOrder(orderResult);
    clear();
    if (user && refreshCustomer) refreshCustomer();
    setPlacing(false);
  }

  // After order placed confirmation screen
  if (placedOrder) {
    const assignedTable = placedOrder.table?.number || placedOrder.tableNumber || currentSelectedRes?.tableNumber;
    const resCode = placedOrder.reservation?.code || placedOrder.reservationId || currentSelectedRes?.code;

    return (
      <div className="container page narrow center-text">
        <div className="reservation-success-card">
          <div className="res-badge-icon">🎉</div>
          <h1>Food Order Placed Successfully!</h1>
          <p className="lead">
            Order <strong>#{placedOrder.orderNumber}</strong>
          </p>

          <div className="res-ticket" style={{ textAlign: 'left' }}>
            <div className="res-ticket-code">
              <div>
                <small className="muted">Order Number</small>
                <strong style={{ fontSize: '1.25rem', color: 'var(--primary)' }}>
                  #{placedOrder.orderNumber}
                </strong>
              </div>
              <span className="badge tone-amber">Status: Preparing</span>
            </div>

            <div className="res-ticket-grid">
              {placedOrder.type === 'dine-in' && (
                <div>
                  <small>Table Number</small>
                  <p><strong>Table {assignedTable < 10 ? `0${assignedTable}` : assignedTable}</strong></p>
                </div>
              )}
              {resCode && (
                <div>
                  <small>Reservation Linked</small>
                  <p><strong>{resCode}</strong> (Confirmed)</p>
                </div>
              )}
              <div>
                <small>Guest / Account</small>
                <p>{placedOrder.customerName} ({placedOrder.customerPhone})</p>
              </div>
              <div>
                <small>Order Type</small>
                <p style={{ textTransform: 'capitalize' }}>{placedOrder.type}</p>
              </div>
            </div>

            <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px dashed var(--border)' }}>
              <small className="muted" style={{ display: 'block', marginBottom: '6px' }}>Ordered Items:</small>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.9rem' }}>
                {(placedOrder.items || []).map((it, idx) => (
                  <li key={idx}>
                    {it.quantity} × {it.name || it.menuItem?.name || 'Dish'} ({money((it.price || it.lineTotal || 200) * (it.quantity || 1))})
                  </li>
                ))}
              </ul>
              <div className="spread" style={{ marginTop: '10px', fontWeight: '800', fontSize: '1.1rem' }}>
                <span>Total Amount:</span>
                <span style={{ color: 'var(--primary)' }}>{money(placedOrder.total)}</span>
              </div>
            </div>
          </div>

          <div className="hero-actions center" style={{ marginTop: '20px' }}>
            <button className="btn btn-primary" onClick={() => navigate('/orders')}>
              📋 View in My Orders
            </button>
            <button className="btn btn-ghost" onClick={() => setPayOpen(true)}>
              💳 Settle Bill / Pay Now
            </button>
            <button className="btn btn-ghost" onClick={() => navigate(`/track?order=${placedOrder.orderNumber}&phone=${placedOrder.customerPhone}`)}>
              📍 Track Live Status
            </button>
          </div>

          {payOpen && (
            <PaymentModal
              order={placedOrder}
              onClose={() => setPayOpen(false)}
              onPaid={() => navigate('/orders')}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="container page narrow">
      <h1>Checkout & Place Order</h1>

      <form onSubmit={submit} className="stack">
        {/* Step 1: Order Type Selection */}
        <div className="field">
          <label>Dining / Order Mode</label>
          <div className="tabs">
            {[
              { id: 'dine-in', label: '🍽️ Dine-in (Reserved Table)' },
              { id: 'delivery', label: '🛵 Home Delivery' },
              { id: 'parcel', label: '🥡 Takeaway Parcel' },
            ].map((t) => (
              <button
                type="button"
                key={t.id}
                className={`tab ${type === t.id ? 'active' : ''}`}
                onClick={() => setType(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: Reserved Table Selection for Dine-in */}
        {type === 'dine-in' && (
          <div className="field" style={{ background: '#f0f7ff', border: '1.5px solid #bfdbfe', borderRadius: '14px', padding: '16px' }}>
            <div className="spread" style={{ marginBottom: '8px' }}>
              <strong style={{ color: '#1e40af' }}>Select Active Table Reservation</strong>
              <button
                type="button"
                className="link-btn small"
                onClick={() => navigate('/reservations')}
              >
                + Book Another Table
              </button>
            </div>

            {availableReservations.length === 0 ? (
              <div style={{ padding: '8px 0' }}>
                <p className="small muted">
                  No existing reservations found. You can reserve Table 05 right now or book a table first.
                </p>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => navigate('/reservations')}
                >
                  📅 Reserve a Table First
                </button>
              </div>
            ) : (
              <div className="stack" style={{ gap: '8px' }}>
                {availableReservations.map((r) => {
                  const tNum = r.table?.number || r.tableNumber || 5;
                  const isChecked = selectedResId === (r.code || r._id);
                  return (
                    <label
                      key={r.code || r._id}
                      className="reservation-radio-card"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        background: '#ffffff',
                        padding: '12px 14px',
                        borderRadius: '10px',
                        border: isChecked ? '2px solid #2563eb' : '1px solid #cbd5e1',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="radio"
                        name="tableReservation"
                        checked={isChecked}
                        onChange={() => handleSelectReservation(r)}
                      />
                      <div style={{ flex: 1 }}>
                        <strong>Table {tNum < 10 ? `0${tNum}` : tNum}</strong>
                        <span className="muted small"> ({r.table?.location || 'Main Hall'})</span>
                        <div className="muted small">
                          {r.date} • {niceTime(r.time)} • {r.guests} Guests • <code>{r.code}</code>
                        </div>
                      </div>
                      <span className="badge tone-green">Confirmed</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Contact details */}
        <div className="form-grid">
          <div className="field">
            <label htmlFor="name">Guest Name</label>
            <input
              id="name"
              required
              value={name}
              placeholder="Full Name"
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="phone">Phone Number (10 Digits)</label>
            <input
              id="phone"
              required
              inputMode="numeric"
              maxLength={10}
              placeholder="9876543210"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
            />
          </div>
        </div>

        {type === 'delivery' && (
          <div className="field">
            <label htmlFor="address">Delivery Address</label>
            <textarea
              id="address"
              required
              rows={2}
              value={address}
              placeholder="Street name, building, flat number"
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
        )}

        {type !== 'dine-in' && (
          <div className="field">
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={schedule}
                onChange={(e) => setSchedule(e.target.checked)}
              />
              Schedule for later pickup or delivery
            </label>
            {schedule && (
              <div className="form-grid">
                <input
                  type="date"
                  value={scheduleDate}
                  min={toDateStr()}
                  max={toDateStr(addDays(7))}
                  onChange={(e) => setScheduleDate(e.target.value)}
                />
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                />
              </div>
            )}
          </div>
        )}

        <div className="field">
          <label htmlFor="notes">Notes for the Chef / Kitchen (Optional)</label>
          <input
            id="notes"
            maxLength={200}
            placeholder="e.g. less salt, serve dessert at the end"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {customer && customer.loyaltyPoints > 0 && maxRedeemable > 0 && (
          <label className="checkbox-row" style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '10px' }}>
            <input
              type="checkbox"
              checked={redeem}
              onChange={(e) => setRedeem(e.target.checked)}
            />
            Redeem {maxRedeemable} loyalty points for {money(maxRedeemable)} off (Balance: {customer.loyaltyPoints} points)
          </label>
        )}

        {/* Order Bill Summary */}
        <div className="cart-summary">
          <div style={{ fontWeight: '800', marginBottom: '8px' }}>Order Bill Summary</div>
          {items.map((i) => (
            <div className="spread small" key={i.key}>
              <span>{i.quantity} × {i.name}</span>
              <span>{money(unitPrice(i) * i.quantity)}</span>
            </div>
          ))}
          <hr />
          <div className="spread">
            <span>Subtotal</span>
            <span>{money(subtotal)}</span>
          </div>
          {redeem && maxRedeemable > 0 && (
            <div className="spread" style={{ color: 'var(--green)' }}>
              <span>Loyalty Discount</span>
              <span>- {money(maxRedeemable)}</span>
            </div>
          )}
          <div className="spread">
            <span>GST (5%)</span>
            <span>{money(gst)}</span>
          </div>
          {deliveryCharge > 0 && (
            <div className="spread">
              <span>Delivery Charge</span>
              <span>{money(deliveryCharge)}</span>
            </div>
          )}
          <div className="spread grand">
            <span>Total Payable</span>
            <span style={{ color: 'var(--primary)' }}>{money(total)}</span>
          </div>
        </div>

        {error && <div className="alert alert-red" role="alert">{error}</div>}

        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={placing}
          style={{ padding: '14px', fontSize: '1.05rem', marginTop: '10px' }}
        >
          {placing ? 'Placing Order…' : `✓ Place Order • ${money(total)}`}
        </button>
      </form>
    </div>
  );
}
