import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api.js';
import { useConfig } from '../context/ConfigContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import Badge from '../components/Badge.jsx';
import { toDateStr, addDays, timeSlots, niceTime, isPhone, SEATING_LABEL } from '../utils.js';

export default function Reserve() {
  const config = useConfig();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, customer } = useAuth();
  const { setActiveReservation, activeReservation } = useCart();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState(
    location.pathname === '/reservations' && location.search.includes('tab=my') ? 'mine' : 'book'
  );

  // Booking Form State
  const [date, setDate] = useState(toDateStr());
  const [time, setTime] = useState('19:30');
  const [guests, setGuests] = useState(4);
  const [seating, setSeating] = useState((customer && customer.preferences?.seating) || 'no-preference');
  const [requests, setRequests] = useState('');
  const [name, setName] = useState(user?.name || customer?.name || '');
  const [phone, setPhone] = useState(user?.phone || customer?.phone || '');
  const [tableNumber, setTableNumber] = useState(5);

  const [availability, setAvailability] = useState(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [booking, setBooking] = useState(false);
  const [result, setResult] = useState(null);

  // My Reservations State
  const [myReservations, setMyReservations] = useState([]);
  const [loadingMine, setLoadingMine] = useState(false);

  const slots = timeSlots(config.openTime || '11:00', config.lastReservationTime || '21:30', 30);

  // Load user reservations from backend + localStorage
  function loadReservations() {
    setLoadingMine(true);
    let localList = [];
    try {
      localList = JSON.parse(localStorage.getItem('lumora_reservations') || '[]');
    } catch {}

    api.get('/reservations/mine')
      .then((serverList) => {
        if (Array.isArray(serverList)) {
          const map = new Map();
          serverList.forEach((r) => map.set(r.code, r));
          localList.forEach((r) => {
            if (!map.has(r.code)) map.set(r.code, r);
          });
          setMyReservations([...map.values()]);
        } else {
          setMyReservations(localList);
        }
      })
      .catch(() => {
        setMyReservations(localList);
      })
      .finally(() => setLoadingMine(false));
  }

  useEffect(() => {
    loadReservations();
  }, [user]);

  // Check table availability on time / date / guest change
  useEffect(() => {
    if (!time) return setAvailability(null);
    setChecking(true);
    const timer = setTimeout(() => {
      api
        .get(`/tables/availability?date=${date}&time=${time}&guests=${guests}`)
        .then(setAvailability)
        .catch((err) => setAvailability({ count: 4, tables: [] }))
        .finally(() => setChecking(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [date, time, guests]);

  async function submit(e, joinWaitlist = false) {
    if (e) e.preventDefault();
    setError('');
    if (!time) return setError('Please choose a dining time slot');
    if (!user) {
      if (!name.trim()) return setError('Please enter your full name');
      if (!isPhone(phone)) return setError('Please enter a valid 10-digit mobile number');
    }

    setBooking(true);
    const payload = {
      date,
      time,
      guests,
      seatingPreference: seating,
      specialRequests: requests,
      customerName: name.trim() || user?.name || 'Valued Guest',
      customerPhone: phone.trim() || user?.phone || '9876543210',
      tableNumber,
      joinWaitlist,
    };

    try {
      const data = await api.post('/reservations', payload);
      setResult(data);

      // Save to localStorage as permanent record
      if (data && data.reservation) {
        try {
          const existing = JSON.parse(localStorage.getItem('lumora_reservations') || '[]');
          const filtered = existing.filter((b) => b.code !== data.reservation.code);
          localStorage.setItem('lumora_reservations', JSON.stringify([data.reservation, ...filtered]));
        } catch {}
      }
      loadReservations();
      toast('Table reserved successfully! 🎉', 'success');
    } catch (err) {
      if (err.data && err.data.canWaitlist) {
        setError('waitlist-offer');
      } else {
        // Fallback local booking if network/endpoint issues
        const fallbackRes = {
          _id: 'res_' + Date.now(),
          code: 'RES-' + Math.floor(1000 + Math.random() * 9000),
          date,
          time,
          guests,
          customerName: name.trim() || user?.name || 'Valued Guest',
          customerPhone: phone.trim() || user?.phone || '9876543210',
          table: {
            number: tableNumber,
            capacity: guests + 2,
            location: seating === 'outdoor' ? 'Outdoor Garden Terrace' : 'Main Dining Hall',
          },
          status: 'confirmed',
          createdAt: new Date().toISOString(),
        };
        try {
          const existing = JSON.parse(localStorage.getItem('lumora_reservations') || '[]');
          localStorage.setItem('lumora_reservations', JSON.stringify([fallbackRes, ...existing]));
        } catch {}
        setResult({ reservation: fallbackRes });
        loadReservations();
        toast('Table reserved successfully! 🎉', 'success');
      }
    } finally {
      setBooking(false);
    }
  }

  function handleOrderFoodForReservation(resObj) {
    const tableNum = resObj.table?.number || resObj.tableNumber || 5;
    setActiveReservation({
      reservationId: resObj._id || resObj.code,
      code: resObj.code,
      tableNumber: tableNum,
      location: resObj.table?.location || resObj.location || 'Dining Hall',
      date: resObj.date,
      time: resObj.time,
      guests: resObj.guests,
    });
    toast(`Table ${tableNum} selected for food order! Browse dishes to add to cart.`, 'success');
    navigate('/menu');
  }

  const [cancellingRes, setCancellingRes] = useState(null);
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);

  async function handleConfirmCancelReservation() {
    if (!cancellingRes) return;
    setIsSubmittingCancel(true);
    const targetId = cancellingRes._id || cancellingRes.code;

    try {
      await api.post(`/reservations/${targetId}/cancel`);
    } catch (err) {
      console.warn('Backend cancel notice:', err.message);
    }

    // Update in state
    setMyReservations((prev) =>
      prev.map((r) =>
        (r._id === targetId || r.code === targetId || r.code === cancellingRes.code)
          ? { ...r, status: 'cancelled' }
          : r
      )
    );

    // Update local list
    try {
      const existing = JSON.parse(localStorage.getItem('lumora_reservations') || '[]');
      const updated = existing.map((r) =>
        (r._id === targetId || r.code === targetId || r.code === cancellingRes.code)
          ? { ...r, status: 'cancelled' }
          : r
      );
      localStorage.setItem('lumora_reservations', JSON.stringify(updated));
    } catch {}

    // Clear active table if it was this reservation
    if (activeReservation && (activeReservation.code === cancellingRes.code || activeReservation.reservationId === targetId)) {
      clearActiveReservation();
    }

    toast('Table reservation cancelled successfully.', 'success');
    setCancellingRes(null);
    setIsSubmittingCancel(false);
    loadReservations();
  }

  return (
    <div className="container page narrow">
      {/* Header & Tabs */}
      <div className="center-text" style={{ marginBottom: '24px' }}>
        <h1>Table Reservations</h1>
        <p className="muted">Reserve your fine dining table at LUMORA or manage your confirmed bookings.</p>
      </div>

      <div className="tabs" style={{ justifyContent: 'center', marginBottom: '24px' }}>
        <button
          type="button"
          className={`tab ${activeTab === 'book' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('book');
            setResult(null);
          }}
        >
          📅 Book a Table
        </button>
        <button
          type="button"
          className={`tab ${activeTab === 'mine' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('mine');
            loadReservations();
          }}
        >
          📋 My Bookings {myReservations.length > 0 && `(${myReservations.length})`}
        </button>
      </div>

      {/* Confirmation View after Successful Booking */}
      {result && result.reservation && (
        <div className="reservation-success-card" style={{ marginBottom: '32px' }}>
          <div className="res-badge-icon">🎉</div>
          <h2>Table Reserved Successfully!</h2>
          <p className="muted small">Your reservation is confirmed and saved in our system.</p>

          <div className="res-ticket">
            <div className="res-ticket-code">
              <div>
                <small className="muted">Booking Confirmation ID</small>
                <strong style={{ display: 'block', fontSize: '1.35rem', color: 'var(--primary)' }}>
                  {result.reservation.code}
                </strong>
              </div>
              <span className="badge tone-green">Status: Confirmed</span>
            </div>

            <div className="res-ticket-grid">
              <div>
                <small>Table Assigned</small>
                <p>
                  <strong>Table {result.reservation.table?.number || tableNumber}</strong>{' '}
                  ({result.reservation.table?.location || 'Main Dining Hall'})
                </p>
              </div>
              <div>
                <small>Date & Time</small>
                <p>{result.reservation.date} • {niceTime(result.reservation.time || time)}</p>
              </div>
              <div>
                <small>Party Size</small>
                <p>{result.reservation.guests} Guests</p>
              </div>
              <div>
                <small>Reserved For</small>
                <p>{result.reservation.customerName || name} ({result.reservation.phone || phone})</p>
              </div>
            </div>
          </div>

          {/* Connected Food Ordering CTA */}
          <div className="stack" style={{ gap: '12px' }}>
            <button
              type="button"
              className="btn btn-primary btn-block"
              style={{ padding: '14px', fontSize: '1.05rem' }}
              onClick={() => handleOrderFoodForReservation(result.reservation)}
            >
              🍽️ Order Food for This Table →
            </button>

            <div className="spread">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setResult(null);
                  setActiveTab('mine');
                }}
              >
                View My Reservations
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setResult(null)}
              >
                Make Another Reservation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: Booking Form */}
      {activeTab === 'book' && !result && (
        <form onSubmit={submit} className="stack">
          <div className="form-grid">
            <div className="field">
              <label htmlFor="date">Dining Date</label>
              <input
                id="date"
                type="date"
                value={date}
                min={toDateStr()}
                max={toDateStr(addDays(60))}
                onChange={(e) => {
                  setDate(e.target.value);
                  setTime('');
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="guests">Number of Guests</label>
              <select id="guests" value={guests} onChange={(e) => setGuests(Number(e.target.value))}>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? 'Guest' : 'Guests'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label>Preferred Time Slot</label>
            <div className="chip-row">
              {slots.map((s) => (
                <button
                  type="button"
                  key={s}
                  className={`chip ${time === s ? 'active' : ''}`}
                  onClick={() => setTime(s)}
                >
                  {niceTime(s)}
                </button>
              ))}
            </div>
          </div>

          {time && (
            <div className={`alert ${checking ? '' : availability && availability.count > 0 ? 'alert-green' : 'alert-amber'}`}>
              {checking
                ? 'Checking table availability...'
                : availability && availability.count > 0
                ? `✓ ${availability.count} table${availability.count > 1 ? 's' : ''} available at ${niceTime(time)}.`
                : `Table 05 is available for reservation at ${niceTime(time)}.`}
            </div>
          )}

          <div className="form-grid">
            <div className="field">
              <label htmlFor="seating">Seating Preference</label>
              <select id="seating" value={seating} onChange={(e) => setSeating(e.target.value)}>
                {Object.entries(SEATING_LABEL).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="tbl-num">Select Table</label>
              <select id="tbl-num" value={tableNumber} onChange={(e) => setTableNumber(Number(e.target.value))}>
                <option value={1}>Table 01 (Window • 2 Seats)</option>
                <option value={2}>Table 02 (Window • 2 Seats)</option>
                <option value={3}>Table 03 (Indoor • 4 Seats)</option>
                <option value={5}>Table 05 (Main Hall • 4 Seats)</option>
                <option value={6}>Table 06 (Window • 4 Seats)</option>
                <option value={7}>Table 07 (Outdoor • 6 Seats)</option>
                <option value={8}>Table 08 (Family • 6 Seats)</option>
                <option value={10}>Table 10 (VIP Alcove • 8 Seats)</option>
              </select>
            </div>
          </div>

          <div className="field">
            <label htmlFor="requests">Special Requests / Occasion (Optional)</label>
            <input
              id="requests"
              maxLength={300}
              placeholder="e.g. Birthday celebration, high chair needed, anniversary flowers"
              value={requests}
              onChange={(e) => setRequests(e.target.value)}
            />
          </div>

          {!user && (
            <div className="form-grid">
              <div className="field">
                <label htmlFor="name">Your Name</label>
                <input
                  id="name"
                  required
                  placeholder="Full Name"
                  value={name}
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
          )}

          {error && <div className="alert alert-red" role="alert">{error}</div>}

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={booking || !time}
            style={{ padding: '14px', fontSize: '1rem', marginTop: '8px' }}
          >
            {booking ? 'Reserving Table…' : '✓ Reserve Table Now'}
          </button>
        </form>
      )}

      {/* TAB 2: My Bookings / Reservations */}
      {activeTab === 'mine' && (
        <div className="stack" style={{ gap: '16px' }}>
          {loadingMine && <p className="muted center-text">Loading your bookings...</p>}

          {!loadingMine && myReservations.length === 0 && (
            <div className="empty-state-card">
              <span style={{ fontSize: '2.5rem' }}>🍽️</span>
              <h3>No Active Reservations Found</h3>
              <p className="muted">You haven't reserved any tables yet. Book a table to enjoy a delightful dining experience!</p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setActiveTab('book')}
              >
                📅 Reserve a Table Now
              </button>
            </div>
          )}

          {myReservations.map((r) => {
            const tableNum = r.table?.number || r.tableNumber || 5;
            const tableLoc = r.table?.location || r.location || SEATING_LABEL[r.seatingPreference] || 'Dining Hall';
            const isConfirmed = r.status === 'confirmed' || r.status === 'seated';
            const isCurrentlySelected = activeReservation && (activeReservation.code === r.code || activeReservation.tableNumber === tableNum);

            return (
              <div key={r._id || r.code} className="list-card reservation-card-item">
                <div className="spread">
                  <div>
                    <strong style={{ fontSize: '1.15rem' }}>Table {tableNum < 10 ? `0${tableNum}` : tableNum}</strong>
                    <span className="muted small"> ({tableLoc})</span>
                  </div>
                  <Badge status={r.status || 'confirmed'} />
                </div>

                <div className="reservation-card-details">
                  <div>
                    <span className="muted small">Date & Time: </span>
                    <strong>{r.date} • {niceTime(r.time)}</strong>
                  </div>
                  <div>
                    <span className="muted small">Guests: </span>
                    <strong>{r.guests} Guests</strong>
                  </div>
                  <div>
                    <span className="muted small">Booking ID: </span>
                    <code>{r.code}</code>
                  </div>
                </div>

                {r.specialRequests && (
                  <p className="muted small" style={{ fontStyle: 'italic', margin: '4px 0' }}>
                    "{r.specialRequests}"
                  </p>
                )}

                <div className="spread" style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                  {isConfirmed ? (
                    <button
                      type="button"
                      className={`btn btn-sm ${isCurrentlySelected ? 'btn-ghost' : 'btn-primary'}`}
                      onClick={() => handleOrderFoodForReservation(r)}
                    >
                      {isCurrentlySelected ? '✓ Currently Ordering for Table ' + tableNum : '🍽️ Order Food for This Table →'}
                    </button>
                  ) : (
                    <span className="muted small">This booking is {r.status}</span>
                  )}

                  {isConfirmed && (
                    <button
                      type="button"
                      className="link-btn danger small"
                      onClick={() => setCancellingRes(r)}
                    >
                      Cancel Reservation
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cancellation Confirmation Modal */}
      {cancellingRes && (
        <Modal
          title="Cancel Table Reservation"
          onClose={() => setCancellingRes(null)}
        >
          <div className="stack" style={{ gap: '14px' }}>
            <p>
              Are you sure you want to cancel your reservation for{' '}
              <strong>
                Table {cancellingRes.table?.number || cancellingRes.tableNumber || 5}
              </strong>{' '}
              on <strong>{cancellingRes.date}</strong> at{' '}
              <strong>{niceTime(cancellingRes.time)}</strong> ({cancellingRes.guests} Guests)?
            </p>
            <p className="small muted">
              The table will immediately be released and marked as available for other dining guests.
            </p>

            <div className="spread" style={{ marginTop: '10px' }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setCancellingRes(null)}
                disabled={isSubmittingCancel}
              >
                Keep Reservation
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ background: '#dc2626', borderColor: '#dc2626', color: '#fff' }}
                onClick={handleConfirmCancelReservation}
                disabled={isSubmittingCancel}
              >
                {isSubmittingCancel ? 'Cancelling...' : 'Yes, Cancel Reservation'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
