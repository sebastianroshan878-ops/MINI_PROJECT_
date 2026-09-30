import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import NotificationBell from './NotificationBell.jsx';
import Badge from './Badge.jsx';
import LumoraLogo from './LumoraLogo.jsx';
import { RESTAURANT_NAME } from '../constants.js';

// Which staff role sees which menu link (role based access control on the screen)
export const ADMIN_LINKS = [
  { to: '/admin', end: true, label: 'Dashboard', icon: '📊', roles: ['admin', 'manager'] },
  { to: '/admin/tables', label: 'Tables', icon: '🪑', roles: ['admin', 'manager', 'waiter'] },
  { to: '/admin/reservations', label: 'Reservations', icon: '📅', roles: ['admin', 'manager', 'waiter'] },
  { to: '/admin/orders', label: 'Orders', icon: '🧾', roles: ['admin', 'manager', 'waiter', 'chef', 'delivery'] },
  { to: '/admin/menu', label: 'Menu', icon: '📖', roles: ['admin', 'manager', 'chef'] },
  { to: '/admin/customers', label: 'Customers', icon: '👥', roles: ['admin', 'manager', 'waiter'] },
  { to: '/admin/payments', label: 'Payments', icon: '💳', roles: ['admin', 'manager'] },
  { to: '/admin/feedback', label: 'Reviews', icon: '⭐', roles: ['admin', 'manager'] },
  { to: '/admin/staff', label: 'Team', icon: '🧑‍🍳', roles: ['admin', 'manager'] },
  { to: '/admin/my-work', label: 'My work', icon: '✅', roles: ['admin', 'manager', 'waiter', 'chef', 'delivery'] },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const links = ADMIN_LINKS.filter((l) => l.roles.includes(user.role));

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <Link to="/admin" className="brand light admin-brand-row">
          <LumoraLogo size={26} light={true} />
          <span>{RESTAURANT_NAME}</span>
        </Link>
        <div className="side-user">
          <strong>{user.name}</strong>
          <Badge tone="amber">{user.role}</Badge>
        </div>
        <nav aria-label="Staff panel">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}>
              <span aria-hidden="true">{l.icon}</span> {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="side-foot">
          <Link to="/" className="side-link">🌐 View website</Link>
          <button className="side-link" onClick={() => { logout(); navigate('/login'); }}>🚪 Log out</button>
        </div>
      </aside>

      <div className="admin-main">
        <div className="admin-top">
          <span className="muted">Staff panel</span>
          <NotificationBell />
        </div>
        <div className="admin-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
