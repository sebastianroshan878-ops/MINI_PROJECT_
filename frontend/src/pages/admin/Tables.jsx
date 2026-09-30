import { useState } from 'react';
import { api } from '../../api.js';
import { usePolling } from '../../hooks/usePolling.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import Badge from '../../components/Badge.jsx';
import Modal from '../../components/Modal.jsx';
import { SEATING_LABEL, niceTime } from '../../utils.js';

const STATUS_CYCLE = { available: 'occupied', occupied: 'cleaning', cleaning: 'available' };
const STATUS_ICON = { available: '✅', occupied: '🍽️', cleaning: '🧹', reserved: '📅' };

function TableForm({ onClose, onSaved, table }) {
  const [form, setForm] = useState(table || { number: '', capacity: 2, location: 'indoor' });
  const [error, setError] = useState('');
  const toast = useToast();

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      if (table) await api.put(`/tables/${table._id}`, form);
      else await api.post('/tables', form);
      toast(table ? 'Table updated' : 'Table added', 'success');
      onSaved();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Modal title={table ? 'Edit table' : 'Add table'} onClose={onClose}>
      <form onSubmit={submit} className="stack">
        <div className="form-grid">
          <div className="field"><label>Table number</label><input type="number" required min={1} value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} /></div>
          <div className="field"><label>Capacity</label><input type="number" required min={1} max={20} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></div>
        </div>
        <div className="field">
          <label>Location</label>
          <select value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}>
            {Object.entries(SEATING_LABEL).filter(([v]) => v !== 'no-preference').map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        {error && <div className="alert alert-red">{error}</div>}
        <button className="btn btn-primary btn-block">{table ? 'Save changes' : 'Add table'}</button>
      </form>
    </Modal>
  );
}

export default function Tables() {
  const { user } = useAuth();
  const canEdit = ['admin', 'manager'].includes(user.role);
  const toast = useToast();
  const [tables, setTables] = useState([]);
  const [formOpen, setFormOpen] = useState(null); // null closed, true = new, object = edit
  const [waitlist, setWaitlist] = useState({ count: null });

  const load = () => api.get('/tables').then(setTables);
  usePolling(load, 15000);
  usePolling(() => api.get('/waitlist?status=waiting').then((list) => setWaitlist({ count: list.length })), 20000);

  async function cycleStatus(table) {
    await api.patch(`/tables/${table._id}/status`, { status: STATUS_CYCLE[table.status] });
    load();
  }

  async function removeTable(table) {
    if (!confirm(`Remove table ${table.number}?`)) return;
    try {
      await api.delete(`/tables/${table._id}`);
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function checkWaitlist() {
    const res = await api.post('/waitlist/promote');
    toast(res.message, res.promoted ? 'success' : 'info');
    load();
  }

  return (
    <div className="stack">
      <div className="spread">
        <h1>Tables</h1>
        <div className="row-actions">
          {waitlist.count > 0 && <button className="btn btn-ghost" onClick={checkWaitlist}>📋 Check waiting list ({waitlist.count})</button>}
          {canEdit && <button className="btn btn-primary" onClick={() => setFormOpen(true)}>+ Add table</button>}
        </div>
      </div>
      <p className="muted small">Tap a table to move it to the next status: available → occupied → cleaning → available.</p>

      <div className="table-board">
        {tables.map((t) => (
          <div key={t._id} className={`table-tile status-${t.effectiveStatus}`}>
            <button className="table-tile-btn" onClick={() => cycleStatus(t)}>
              <span className="table-icon">{STATUS_ICON[t.effectiveStatus]}</span>
              <strong>Table {t.number}</strong>
              <span className="muted small">{t.capacity} seats • {SEATING_LABEL[t.location]}</span>
              <Badge status={t.effectiveStatus} />
            </button>
            {t.nextReservation && <p className="table-note">Next: {t.nextReservation.name} ({t.nextReservation.guests}) at {niceTime(t.nextReservation.time)}</p>}
            {canEdit && (
              <div className="row-actions">
                <button className="link-btn" onClick={() => setFormOpen(t)}>Edit</button>
                <button className="link-btn danger" onClick={() => removeTable(t)}>Remove</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {formOpen && <TableForm table={formOpen === true ? null : formOpen} onClose={() => setFormOpen(null)} onSaved={() => { setFormOpen(null); load(); }} />}
    </div>
  );
}
