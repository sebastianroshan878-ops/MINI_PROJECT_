import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { useToast } from '../../context/ToastContext.jsx';
import Badge from '../../components/Badge.jsx';
import { toDateStr, dateTime, SEATING_LABEL } from '../../utils.js';

const NEXT_ACTIONS = {
  confirmed: [['seated', 'Seat now'], ['no-show', 'No-show'], ['cancelled', 'Cancel']],
  seated: [['completed', 'Mark completed']],
};

export default function Reservations() {
  const toast = useToast();
  const [date, setDate] = useState(toDateStr());
  const [status, setStatus] = useState('');
  const [list, setList] = useState([]);
  const [tables, setTables] = useState([]);
  const [moving, setMoving] = useState(null);

  const load = () => {
    const params = new URLSearchParams({ date });
    if (status) params.set('status', status);
    api.get(`/reservations?${params}`).then(setList);
  };
  useEffect(load, [date, status]);
  useEffect(() => { api.get('/tables').then(setTables); }, []);

  async function setNext(res, next) {
    try {
      await api.patch(`/reservations/${res._id}/status`, { status: next });
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function moveTable(res, tableId) {
    try {
      await api.patch(`/reservations/${res._id}/table`, { tableId });
      toast('Table changed', 'success');
      setMoving(null);
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  const [activeTab, setActiveTab] = useState('all'); // 'all', 'active', 'completed', 'cancelled'

  const displayedList = list.filter((r) => {
    if (activeTab === 'active') return ['confirmed'].includes(r.status);
    if (activeTab === 'completed') return ['seated', 'completed'].includes(r.status);
    if (activeTab === 'cancelled') return ['cancelled', 'no-show'].includes(r.status);
    return true;
  });

  return (
    <div className="stack">
      <div className="spread">
        <h1>Reservations</h1>
        <div className="chip-row">
          <button
            type="button"
            className={`chip ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            All Bookings ({list.length})
          </button>
          <button
            type="button"
            className={`chip ${activeTab === 'active' ? 'active' : ''}`}
            onClick={() => setActiveTab('active')}
          >
            Active ({list.filter((r) => r.status === 'confirmed').length})
          </button>
          <button
            type="button"
            className={`chip ${activeTab === 'completed' ? 'active' : ''}`}
            onClick={() => setActiveTab('completed')}
          >
            Completed ({list.filter((r) => ['seated', 'completed'].includes(r.status)).length})
          </button>
          <button
            type="button"
            className={`chip ${activeTab === 'cancelled' ? 'active' : ''}`}
            onClick={() => setActiveTab('cancelled')}
          >
            Cancelled ({list.filter((r) => ['cancelled', 'no-show'].includes(r.status)).length})
          </button>
        </div>
      </div>

      <div className="form-grid">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {['confirmed', 'seated', 'completed', 'cancelled', 'no-show'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="table-scroll">
        <table className="data-table">
          <thead><tr><th>Time</th><th>Guest</th><th>Guests</th><th>Table</th><th>Preference</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {displayedList.map((r) => (
              <tr key={r._id || r.code}>
                <td>{r.time}</td>
                <td>
                  <strong>{r.customerName}</strong>
                  <br />
                  <span className="muted small">{r.phone}</span>
                  {r.specialRequests && <div className="muted small">📝 {r.specialRequests}</div>}
                  {r.status === 'cancelled' && (
                    <div className="small" style={{ color: '#b91c1c', marginTop: '4px' }}>
                      🚫 Cancelled {r.cancelledBy ? `by ${r.cancelledBy}` : ''}
                      {r.cancelledAt ? ` at ${dateTime(r.cancelledAt)}` : ''}
                    </div>
                  )}
                </td>
                <td>{r.guests}</td>
                <td>
                  {moving === r._id ? (
                    <select autoFocus onBlur={() => setMoving(null)} onChange={(e) => moveTable(r, e.target.value)} defaultValue="">
                      <option value="" disabled>Choose table</option>
                      {tables.filter((t) => t.capacity >= r.guests).map((t) => <option key={t._id} value={t._id}>Table {t.number} ({t.capacity})</option>)}
                    </select>
                  ) : (
                    <button className="link-btn" onClick={() => r.status === 'confirmed' && setMoving(r._id)}>Table {r.table?.number || r.tableNumber || 5}</button>
                  )}
                </td>
                <td>{SEATING_LABEL[r.seatingPreference]}</td>
                <td><Badge status={r.status} /></td>
                <td>
                  <div className="row-actions">
                    {(NEXT_ACTIONS[r.status] || []).map(([next, label]) => (
                      <button key={next} className="link-btn" onClick={() => setNext(r, next)}>{label}</button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
            {displayedList.length === 0 && <tr><td colSpan={7} className="muted center-text">No reservations match this filter.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
