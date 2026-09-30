import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const user = await login(email, password);
      const back = location.state && location.state.from;
      navigate(back || (user.role === 'customer' ? '/' : '/admin'));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function fill(demoEmail) {
    setEmail(demoEmail);
    setPassword(demoEmail === 'customer@demo.com' ? 'customer123' : demoEmail === 'admin@restaurantpro.com' ? 'admin123' : 'staff123');
  }

  return (
    <div className="container page narrow">
      <h1>Log in</h1>
      <form onSubmit={submit} className="stack">
        <div className="field"><label htmlFor="email">Email</label><input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="field"><label htmlFor="password">Password</label><input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        {error && <div className="alert alert-red" role="alert">{error}</div>}
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Logging in...' : 'Log in'}</button>
      </form>
      <p className="center-text muted">New here? <Link to="/register">Create an account</Link></p>

      <div className="demo-box">
        <strong>Try a demo account</strong>
        <p className="muted small">Click a role to fill the form, then log in. (Run the seed script first — see the README.)</p>
        <div className="chip-row">
          <button className="chip" onClick={() => fill('customer@demo.com')}>Customer</button>
          <button className="chip" onClick={() => fill('admin@restaurantpro.com')}>Admin</button>
          <button className="chip" onClick={() => fill('manager@restaurantpro.com')}>Manager</button>
          <button className="chip" onClick={() => fill('waiter@restaurantpro.com')}>Waiter</button>
          <button className="chip" onClick={() => fill('chef@restaurantpro.com')}>Chef</button>
          <button className="chip" onClick={() => fill('delivery@restaurantpro.com')}>Delivery</button>
        </div>
      </div>
    </div>
  );
}
