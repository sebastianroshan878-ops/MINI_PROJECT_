import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import Modal from '../../components/Modal.jsx';
import Badge from '../../components/Badge.jsx';
import { STAFF_ROLES } from '../../constants.js';

function AddStaffForm({ onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', role: 'waiter' });
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/staff', form);
      toast('Team member added', 'success');
      onSaved();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Modal title="Add team member" onClose={onClose}>
      <form onSubmit={submit} className="stack">
        <div className="field"><label>Name</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div className="field"><label>Email</label><input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div className="field"><label>Phone</label><input inputMode="numeric" maxLength={10} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '') })} /></div>
        <div className="field"><label>Temporary password</label><input required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
        <div className="field"><label>Role</label>
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {STAFF_ROLES.filter((r) => r !== 'customer').map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        {error && <div className="alert alert-red">{error}</div>}
        <button className="btn btn-primary btn-block">Add team member</button>
      </form>
    </Modal>
  );
}

export default function Staff() {
  const { user } = useAuth();
  const toast = useToast();
  const [staff, setStaff] = useState([]);
  const [performance, setPerformance] = useState([]);
  const [formOpen, setFormOpen] = useState(false);

  const load = () => {
    api.get('/staff').then(setStaff);
    api.get('/staff/performance').then(setPerformance);
  };
  useEffect(load, []);

  async function toggleActive(member) {
    if (member._id === user._id) return toast('You cannot deactivate yourself', 'error');
    try {
      await api.put(`/staff/${member._id}`, { isActive: !member.isActive });
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function changeRole(member, role) {
    try {
      await api.put(`/staff/${member._id}`, { role });
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  const perfFor = (id) => performance.find((p) => String(p._id) === String(id));

  return (
    <div className="stack">
      <div className="spread">
        <h1>Team</h1>
        {user.role === 'admin' && <button className="btn btn-primary" onClick={() => setFormOpen(true)}>+ Add team member</button>}
      </div>

      <div className="table-scroll">
        <table className="data-table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Active</th><th>Tasks (30d)</th><th>Avg rating</th><th>Days present</th></tr></thead>
          <tbody>
            {staff.map((m) => {
              const p = perfFor(m._id);
              const isMe = m._id === user._id;
              return (
                <tr key={m._id} className={!m.isActive ? 'muted-row' : ''}>
                  <td>{m.name}{isMe && ' (you)'}</td>
                  <td>{m.email}</td>
                  <td>
                    {user.role === 'admin' && !isMe ? (
                      <select value={m.role} onChange={(e) => changeRole(m, e.target.value)}>
                        {STAFF_ROLES.filter((r) => r !== 'customer').map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    ) : <Badge tone="amber">{m.role}</Badge>}
                  </td>
                  <td>{user.role === 'admin' && !isMe ? <input type="checkbox" checked={m.isActive} onChange={() => toggleActive(m)} /> : (m.isActive ? '✅' : '❌')}</td>
                  <td>{p ? `${p.tasksDone}/${p.tasksAssigned}` : '—'}</td>
                  <td>{p && p.avgRating ? `${p.avgRating} ★` : '—'}</td>
                  <td>{p ? p.daysPresent : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {formOpen && <AddStaffForm onClose={() => setFormOpen(false)} onSaved={() => { setFormOpen(false); load(); }} />}
    </div>
  );
}
