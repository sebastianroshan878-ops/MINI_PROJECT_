import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import { useConfig } from '../context/ConfigContext.jsx';
import { money } from '../utils.js';

export default function Cart() {
  const { items, setQuantity, subtotal, unitPrice } = useCart();
  const config = useConfig();
  const navigate = useNavigate();

  const willGetDeliveryCharge = subtotal > 0 && subtotal < config.freeDeliveryAbove;

  return (
    <div className="container page narrow">
      <h1>Your Cart</h1>
      {items.length === 0 ? (
        <div className="empty-state">
          <p>Your cart is empty.</p>
          <Link to="/menu" className="btn btn-primary">Browse the menu</Link>
        </div>
      ) : (
        <>
          <ul className="cart-list">
            {items.map((item) => (
              <li key={item.key} className="cart-row">
                <span className="dish-emoji">{item.emoji}</span>
                <div className="cart-row-info">
                  <strong>{item.name}</strong>
                  {item.addOns.length > 0 && <small>+ {item.addOns.map((a) => a.name).join(', ')}</small>}
                  {item.spiceLevel && <small> {item.spiceLevel} spice</small>}
                  {item.note && <small>Note: {item.note}</small>}
                  <span className="muted">{money(unitPrice(item))} each</span>
                </div>
                <div className="qty-stepper">
                  <button onClick={() => setQuantity(item.key, item.quantity - 1)} aria-label="Decrease">−</button>
                  <span>{item.quantity}</span>
                  <button onClick={() => setQuantity(item.key, item.quantity + 1)} aria-label="Increase">+</button>
                </div>
                <strong>{money(unitPrice(item) * item.quantity)}</strong>
              </li>
            ))}
          </ul>

          <div className="cart-summary">
            <div className="spread"><span>Subtotal</span><span>{money(subtotal)}</span></div>
            <p className="muted small">GST and, for delivery orders under {money(config.freeDeliveryAbove)}, a {money(config.deliveryCharge)} delivery charge are added at checkout.</p>
            {willGetDeliveryCharge && <p className="hint">Add {money(config.freeDeliveryAbove - subtotal)} more for free delivery.</p>}
            <button className="btn btn-primary btn-block" onClick={() => navigate('/checkout')}>Proceed to checkout</button>
          </div>
        </>
      )}
    </div>
  );
}
