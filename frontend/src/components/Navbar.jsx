import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import LumoraLogo from './LumoraLogo.jsx';
import NotificationBell from './NotificationBell.jsx';
import { RESTAURANT_NAME } from '../constants.js';

export default function Navbar() {
  const { user, isStaff, logout } = useAuth();
  const { count, activeReservation } = useCart();
  const navigate = useNavigate();
  const [navSearch, setNavSearch] = useState('');

  const linkClass = ({ isActive }) => (isActive ? 'nav-item active' : 'nav-item');

  function handleSearch(e) {
    e.preventDefault();
    if (navSearch.trim()) {
      navigate(`/menu?search=${encodeURIComponent(navSearch.trim())}`);
    } else {
      navigate('/menu');
    }
  }

  return (
    <header className="nav">
      <div className="container nav-inner">
        {/* Brand with modern Logo */}
        <Link to="/" className="brand brand-lumora">
          <LumoraLogo size={32} />
          <span className="brand-text">{RESTAURANT_NAME}</span>
        </Link>

        {/* Primary Navigation Links */}
        <nav className="nav-links" aria-label="Main Navigation">
          <NavLink to="/" end className={linkClass}>Home</NavLink>
          <NavLink to="/menu" className={linkClass}>Menu</NavLink>
          <NavLink to="/reservations" className={linkClass}>
            Reservations
            {activeReservation && <span className="nav-active-pill" title={`Table ${activeReservation.tableNumber}`}>T{activeReservation.tableNumber}</span>}
          </NavLink>
          <NavLink to="/orders" className={linkClass}>My Orders</NavLink>
        </nav>

        {/* Integrated Search Bar with icon on the RIGHT side */}
        <form onSubmit={handleSearch} className="nav-search-container" role="search">
          <input
            type="text"
            className="nav-search-input"
            placeholder="Search dishes…"
            value={navSearch}
            onChange={(e) => setNavSearch(e.target.value)}
            aria-label="Search dishes"
          />
          <button type="submit" className="nav-search-icon-btn" aria-label="Submit search" title="Search dishes">
            🔍
          </button>
        </form>

        {/* User Account & Cart Controls */}
        <div className="nav-right">
          <Link to="/cart" className="cart-link" aria-label={`Cart, ${count} items`}>
            🛒<span className="cart-count">{count}</span>
          </Link>
          {user && <NotificationBell />}
          {!user ? (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm">Log in</Link>
              <Link to="/register" className="btn btn-primary btn-sm">Sign up</Link>
            </>
          ) : (
            <>
              <Link to={isStaff ? '/admin' : '/profile'} className="btn btn-ghost btn-sm user-badge-link">
                {isStaff ? 'Staff Panel' : user.name.split(' ')[0]}
              </Link>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  logout();
                  navigate('/');
                }}
              >
                Log out
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
