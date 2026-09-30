import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { usePolling } from '../../hooks/usePolling.js';
import Modal from '../../components/Modal.jsx';
import { StarInput } from '../../components/Stars.jsx';
import Badge from '../../components/Badge.jsx';
import { dateTime } from '../../utils.js';
import { STAFF_ROLES } from '../../constants.js';

// Assign a new task (managers only)
function AssignTaskForm({ onClose, onSaved }) {
  const toast = useToast();
  const [staff, setStaff] = useState([]);
  const [form, setForm] = useState({ title: '', description: '', assignedTo: '', priority: 'medium', dueAt: '' });

  useEffect(() => { api.get('/staff').then((list) => setStaff(list.filter((s) => s.isActive))); }, []);

  async function submit(e) {
    e.preventDefault();
    try {
      await api.post('/tasks', { ...form, dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : undefined });
      toast('Task assigned', 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return (
    <Modal title="Assign a task" onClose={onClose}>
      <form onSubmit={submit} className="stack">
        <div className="field"><label>Title</label><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
        <div className="field"><label>Details (optional)</label><textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div className="field"><label>Assign to</label>
          <select required value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}>
            <option value="" disabled>Choose a team member</option>
            {staff.map((s) => <option key={s._id} value={s._id}>{s.name} ({s.role})</option>)}
          </select>
        </div>
        <div className="form-grid">
          <div className="field"><label>Priority</label>
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
            </select>
          </div>
          <div className="field"><label>Due (optional)</label><input type="datetime-local" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} /></div>
        </div>
        <button className="btn btn-primary btn-block">Assign task</button>
      </form>
    </Modal>
  );
}

function RateModal({ task, onClose, onDone }) {
  const [rating, setRating] = useState(5);
  return (
    <Modal title={`Rate "${task.title}"`} onClose={onClose}>
      <div className="center-text"><StarInput value={rating} onChange={setRating} /></div>
      <button className="btn btn-primary btn-block" onClick={() => onDone(rating)}>Save rating</button>
    </Modal>
  );
}

export default function MyWork() {
  const { user } = useAuth();
  const toast = useToast();
  const isManager = ['admin', 'manager'].includes(user.role);
  const [tasks, setTasks] = useState([]);
  const [today, setToday] = useState(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [rateTask, setRateTask] = useState(null);

  const load = () => api.get('/tasks').then(setTasks);
  usePolling(load, 20000);
  useEffect(() => { api.get('/attendance/today').then(setToday).catch(() => setToday(null)); }, []);

  async function setStatus(task, status) {
    await api.patch(`/tasks/${task._id}/status`, { status });
    load();
  }
  async function saveRating(rating) {
    await api.patch(`/tasks/${rateTask._id}/rate`, { rating });
    setRateTask(null);
    load();
  }
  async function checkIn() { setToday(await api.post('/attendance/check-in')); toast('Checked in', 'success'); }
  async function checkOut() { setToday(await api.post('/attendance/check-out')); toast('Checked out', 'success'); }

  return (
    <div className="stack">
      <div className="spread">
        <h1>My work</h1>
        {isManager && <button className="btn btn-primary" onClick={() => setAssignOpen(true)}>+ Assign task</button>}
      </div>

      <div className="panel spread">
        <div>
          <strong>Attendance today</strong>
          <p className="muted small">{today ? `Checked in at ${dateTime(today.checkIn)}${today.checkOut ? `, out at ${dateTime(today.checkOut)}` : ''}` : 'Not checked in yet'}</p>
        </div>
        {!today && <button className="btn btn-primary" onClick={checkIn}>Check in</button>}
        {today && !today.checkOut && <button className="btn btn-ghost" onClick={checkOut}>Check out</button>}
      </div>

      <div className="stack">
        {tasks.map((t) => (
          <div key={t._id} className="list-card">
            <div className="spread">
              <strong>{t.title}</strong>
              <Badge status={t.status} />
            </div>
            <p className="muted small">
              {isManager && `${t.assignedTo.name} (${t.assignedTo.role}) • `}
              Priority: {t.priority}{t.dueAt && ` • Due ${dateTime(t.dueAt)}`}
            </p>
            {t.description && <p className="small">{t.description}</p>}
            <div className="row-actions">
              {t.status === 'pending' && <button className="link-btn" onClick={() => setStatus(t, 'in-progress')}>Start</button>}
              {t.status === 'in-progress' && <button className="link-btn" onClick={() => setStatus(t, 'done')}>Mark done</button>}
              {t.status === 'done' && isManager && !t.rating && <button className="link-btn" onClick={() => setRateTask(t)}>Rate</button>}
              {t.rating && <span className="muted small">Rated {t.rating} ★</span>}
            </div>
          </div>
        ))}
        {tasks.length === 0 && <p className="muted">No tasks right now.</p>}
      </div>

      {assignOpen && <AssignTaskForm onClose={() => setAssignOpen(false)} onSaved={() => { setAssignOpen(false); load(); }} />}
      {rateTask && <RateModal task={rateTask} onClose={() => setRateTask(null)} onDone={saveRating} />}
    </div>
  );
}
