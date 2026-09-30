import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { isEmail, isPhone } from '../utils.js';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!isEmail(form.email)) return setError('Enter a valid email address');
    if (!isPhone(form.phone)) return setError('Phone number must be 10 digits');
    if (form.password.length < 6) return setError('Password must be at least 6 characters');

    setBusy(true);
    try {
      await register(form);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container page narrow">
      <h1>Create your account</h1>
      <form onSubmit={submit} className="stack">
        <div className="field"><label htmlFor="name">Full name</label><input id="name" required value={form.name} onChange={set('name')} /></div>
        <div className="field"><label htmlFor="email">Email</label><input id="email" type="email" required value={form.email} onChange={set('email')} /></div>
        <div className="field"><label htmlFor="phone">Phone number</label><input id="phone" required inputMode="numeric" maxLength={10} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '') })} /></div>
        <div className="field"><label htmlFor="password">Password</label><input id="password" type="password" required value={form.password} onChange={set('password')} /><p className="hint">At least 6 characters.</p></div>
        {error && <div className="alert alert-red" role="alert">{error}</div>}
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Creating account...' : 'Sign up'}</button>
      </form>
      <p className="center-text muted">Already have an account? <Link to="/login">Log in</Link></p>
    </div>
  );
}
