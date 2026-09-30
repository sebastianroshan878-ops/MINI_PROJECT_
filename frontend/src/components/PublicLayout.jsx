import { Outlet, Link } from 'react-router-dom';
import Navbar from './Navbar.jsx';
import LumoraLogo from './LumoraLogo.jsx';
import { useConfig } from '../context/ConfigContext.jsx';
import { RESTAURANT_NAME, RESTAURANT_TAGLINE } from '../constants.js';

export default function PublicLayout() {
  const config = useConfig();
  const restName = (config && config.restaurant && config.restaurant.name) || RESTAURANT_NAME;
  const tagline = (config && config.restaurant && config.restaurant.tagline) || RESTAURANT_TAGLINE;
  const address = (config && config.restaurant && config.restaurant.address) || '12 Spice Street, Main Market Road';
  const phone = (config && config.restaurant && config.restaurant.phone) || '+91 98765 43210';

  return (
    <>
      <Navbar />
      <main>
        <Outlet />
      </main>
      <footer className="footer">
        <div className="container footer-inner">
          <div className="footer-brand-col">
            <div className="footer-brand-heading">
              <LumoraLogo size={28} light={true} />
              <strong className="footer-logo-text">{restName}</strong>
            </div>
            <p className="footer-tagline">{tagline}</p>
            <p className="footer-contact-info">{address}</p>
            <p className="footer-contact-info">Call {phone}</p>
            <div className="footer-social-icons">
              <span className="social-icon-badge" title="Instagram">📸</span>
              <span className="social-icon-badge" title="Facebook">👍</span>
              <span className="social-icon-badge" title="Twitter / X">🐦</span>
            </div>
          </div>

          <div className="footer-nav-col">
            <strong>Explore</strong>
            <ul className="footer-links-list">
              <li><Link to="/">Home</Link></li>
              <li><Link to="/menu">Menu</Link></li>
              <li><Link to="/reservations">Reservations</Link></li>
              <li><Link to="/orders">My Orders</Link></li>
            </ul>
          </div>

          <div className="footer-nav-col">
            <strong>Guest Services</strong>
            <ul className="footer-links-list">
              <li><Link to="/reservations">Reserve a Table</Link></li>
              <li><Link to="/track">Track Order</Link></li>
              <li><a href={`tel:${phone}`}>Contact</a></li>
              <li><Link to="/profile">Loyalty Rewards</Link></li>
            </ul>
          </div>

          <div className="footer-nav-col">
            <strong>Legal & Support</strong>
            <ul className="footer-links-list">
              <li><a href="#privacy" onClick={(e) => { e.preventDefault(); alert('LUMORA Privacy Policy: Your dining and account data is protected.'); }}>Privacy Policy</a></li>
              <li><a href="#terms" onClick={(e) => { e.preventDefault(); alert('LUMORA Terms & Conditions: Bookings are held for 90 minutes. Cancellations permitted up to reservation time.'); }}>Terms & Conditions</a></li>
              <li><span className="footer-fineprint">© {new Date().getFullYear()} {restName}. All rights reserved.</span></li>
            </ul>
          </div>
        </div>
      </footer>
    </>
  );
}
