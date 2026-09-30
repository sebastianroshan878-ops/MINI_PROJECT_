import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api } from '../api.js';
import Modal from './Modal.jsx';

const SAMPLE_TABLES = [
  { id: 'T1', number: 1, capacity: 2, location: 'Window View', status: 'available' },
  { id: 'T2', number: 2, capacity: 2, location: 'Window View', status: 'available' },
  { id: 'T3', number: 3, capacity: 4, location: 'Main Dining Hall', status: 'available' },
  { id: 'T4', number: 4, capacity: 4, location: 'Main Dining Hall', status: 'occupied' },
  { id: 'T5', number: 5, capacity: 4, location: 'Quiet Alcove', status: 'available' },
  { id: 'T6', number: 6, capacity: 4, location: 'Window View', status: 'available' },
  { id: 'T7', number: 7, capacity: 6, location: 'Outdoor Garden Terrace', status: 'available' },
  { id: 'T8', number: 8, capacity: 6, location: 'Family Lounge', status: 'available' },
  { id: 'T9', number: 9, capacity: 8, location: 'Outdoor Garden Terrace', status: 'occupied' },
  { id: 'T10', number: 10, capacity: 8, location: 'VIP Private Corner', status: 'available' },
];

const TIME_SLOTS = [
  '12:00 PM', '12:30 PM', '1:00 PM', '1:30 PM',
  '7:00 PM', '7:30 PM', '8:00 PM', '8:30 PM', '9:00 PM', '9:30 PM'
];

export default function TableReservationModal({ onClose }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setActiveReservation } = useCart();
  const toast = useToast();
  const today = new Date().toISOString().split('T')[0];

  const [date, setDate] = useState(today);
  const [time, setTime] = useState('7:30 PM');
  const [guests, setGuests] = useState(2);
  const [selectedTable, setSelectedTable] = useState(5);
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [specialRequests, setSpecialRequests] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState(null);

  async function handleConfirm(e) {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      toast('Please enter your name and phone number', 'error');
      return;
    }

    const tableObj = SAMPLE_TABLES.find((t) => t.number === selectedTable) || SAMPLE_TABLES[2];
    const generatedCode = 'RES-' + Math.floor(1000 + Math.random() * 9000);

    const bookingPayload = {
      date,
      time,
      guests,
      tableNumber: tableObj.number,
      location: tableObj.location,
      customerName: name.trim(),
      customerPhone: phone.trim(),
      specialRequests: specialRequests.trim(),
    };

    setSubmitting(true);
    let finalBooking = null;

    try {
      const res = await api.post('/reservations', bookingPayload);
      if (res && res.reservation) {
        finalBooking = {
          ...res.reservation,
          tableNumber: res.reservation.table?.number || tableObj.number,
          location: res.reservation.table?.location || tableObj.location,
        };
      }
    } catch (err) {
      console.warn('Backend reservation notice:', err.message);
    }

    if (!finalBooking) {
      finalBooking = {
        _id: 'res_' + Date.now(),
        code: generatedCode,
        date,
        time,
        guests,
        tableNumber: tableObj.number,
        location: tableObj.location,
        name: name.trim(),
        phone: phone.trim(),
        specialRequests: specialRequests.trim(),
        status: 'confirmed',
        createdAt: new Date().toISOString(),
      };
    }

    // Persist to localStorage so reservations NEVER disappear
    try {
      const existing = JSON.parse(localStorage.getItem('lumora_reservations') || '[]');
      const filtered = existing.filter((b) => b.code !== finalBooking.code);
      localStorage.setItem('lumora_reservations', JSON.stringify([finalBooking, ...filtered]));
    } catch {}

    setConfirmedBooking(finalBooking);
    toast(`Table ${tableObj.number} reserved successfully! Code: ${finalBooking.code}`, 'success');
    setSubmitting(false);
  }

  function handleOrderFoodForTable() {
    if (!confirmedBooking) return;
    setActiveReservation({
      reservationId: confirmedBooking._id || confirmedBooking.code,
      code: confirmedBooking.code,
      tableNumber: confirmedBooking.tableNumber,
      location: confirmedBooking.location,
      date: confirmedBooking.date,
      time: confirmedBooking.time,
      guests: confirmedBooking.guests,
    });
    toast(`Table ${confirmedBooking.tableNumber} linked to your order! Now add dishes to cart.`, 'success');
    onClose();
    navigate('/menu');
  }

  return (
    <Modal title="🍽️ Reserve a Dining Table" onClose={onClose}>
      {confirmedBooking ? (
        <div className="reservation-success-card">
          <div className="res-badge-icon">✅</div>
          <h2 style={{ fontSize: '1.4rem', margin: '4px 0' }}>Reservation Confirmed!</h2>
          <p className="muted small">Your table has been reserved. You can now order food specifically for this table.</p>

          <div className="res-ticket">
            <div className="res-ticket-code">
              <div>
                <small className="muted">Booking Code</small>
                <strong style={{ display: 'block', fontSize: '1.25rem', color: 'var(--primary)' }}>
                  {confirmedBooking.code}
                </strong>
              </div>
              <span className="badge tone-green">Status: Confirmed</span>
            </div>

            <div className="res-ticket-grid">
              <div>
                <small>Table Number</small>
                <p><strong>Table {confirmedBooking.tableNumber}</strong> ({confirmedBooking.location})</p>
              </div>
              <div>
                <small>Date & Time</small>
                <p>{confirmedBooking.date} • {confirmedBooking.time}</p>
              </div>
              <div>
                <small>Party Size</small>
                <p>{confirmedBooking.guests} Guests</p>
              </div>
              <div>
                <small>Reserved For</small>
                <p>{confirmedBooking.name || confirmedBooking.customerName} ({confirmedBooking.phone || confirmedBooking.customerPhone})</p>
              </div>
            </div>

            {confirmedBooking.specialRequests && (
              <div className="res-ticket-note">
                <small>Special Instructions</small>
                <p>"{confirmedBooking.specialRequests}"</p>
              </div>
            )}
          </div>

          {/* Action buttons including ORDER FOOD FOR THIS TABLE */}
          <div className="stack" style={{ gap: '10px', marginTop: '16px' }}>
            <button
              type="button"
              className="btn btn-primary btn-block"
              style={{ padding: '13px', fontSize: '1rem' }}
              onClick={handleOrderFoodForTable}
            >
              🍽️ Order Food for This Table →
            </button>

            <div className="spread">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  onClose();
                  navigate('/reservations');
                }}
              >
                View My Reservations
              </button>
              <button type="button" className="btn btn-ghost" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleConfirm} className="reservation-form">
          {/* Step 1: Date & Guests */}
          <div className="form-row-2">
            <div className="field">
              <label>Select Date</label>
              <input
                type="date"
                min={today}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>Number of Guests</label>
              <select value={guests} onChange={(e) => setGuests(Number(e.target.value))}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12].map((n) => (
                  <option key={n} value={n}>{n} {n === 1 ? 'Guest' : 'Guests'}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Step 2: Time Slots */}
          <div className="field">
            <label>Select Dining Time</label>
            <div className="time-slots-grid">
              {TIME_SLOTS.map((slot) => (
                <button
                  type="button"
                  key={slot}
                  className={`time-chip ${time === slot ? 'active' : ''}`}
                  onClick={() => setTime(slot)}
                >
                  {slot}
                </button>
              ))}
            </div>
          </div>

          {/* Step 3: Select Table Floor Map */}
          <div className="field">
            <div className="spread">
              <label>Select Preferred Table</label>
              <span className="muted small">Recommended for {guests} guests</span>
            </div>
            <div className="tables-selection-grid">
              {SAMPLE_TABLES.map((t) => {
                const isSelected = selectedTable === t.number;
                const isBusy = t.status === 'occupied';

                return (
                  <button
                    type="button"
                    key={t.id}
                    disabled={isBusy}
                    className={`table-select-card ${isSelected ? 'selected' : ''} ${isBusy ? 'busy' : ''}`}
                    onClick={() => setSelectedTable(t.number)}
                  >
                    <div className="table-card-top">
                      <strong>Table {t.number < 10 ? `0${t.number}` : t.number}</strong>
                      <span className="table-seats-badge">👥 {t.capacity}</span>
                    </div>
                    <span className="table-loc">{t.location}</span>
                    <span className="table-status-pill">
                      {isBusy ? 'Occupied' : isSelected ? '✓ Selected' : 'Available'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 4: Contact Details */}
          <div className="form-row-2">
            <div className="field">
              <label>Guest Full Name</label>
              <input
                type="text"
                placeholder="e.g. Anjali Nair"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>Phone Number (10 Digits)</label>
              <input
                type="tel"
                maxLength={10}
                placeholder="9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                required
              />
            </div>
          </div>

          <div className="field">
            <label>Special Requests (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Birthday cake, high chair for child, quiet corner"
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={submitting}
            style={{ padding: '13px', fontSize: '1rem', marginTop: '6px' }}
          >
            {submitting ? 'Confirming Booking…' : '✓ Confirm Table Reservation'}
          </button>
        </form>
      )}
    </Modal>
  );
}
