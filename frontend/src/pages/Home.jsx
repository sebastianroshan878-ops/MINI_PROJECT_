import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api } from '../api.js';
import { FOOD_CATEGORIES, DEFAULT_DISHES } from '../constants.js';
import TableReservationModal from '../components/TableReservationModal.jsx';
import OrderTrackingModal from '../components/OrderTrackingModal.jsx';
import { money } from '../utils.js';

export default function Home() {
  const navigate = useNavigate();
  const toast = useToast();
  const { items: cartItems, addItem, setQuantity, clear: clearCart, subtotal, count } = useCart();

  // State
  const [dishes, setDishes] = useState(DEFAULT_DISHES);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [dietFilter, setDietFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [quantities, setQuantities] = useState({});
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [activeOrder, setActiveOrder] = useState(null);
  const [orderType, setOrderType] = useState('dine-in'); // 'dine-in', 'delivery', 'parcel'
  const [selectedTable, setSelectedTable] = useState('Table 4 (Indoor)');

  // Fetch real menu from backend if available, fallback gracefully to DEFAULT_DISHES
  useEffect(() => {
    api.get('/menu')
      .then((serverItems) => {
        if (Array.isArray(serverItems) && serverItems.length > 0) {
          // Merge server items with realistic fallback photos if image is missing
          const enriched = serverItems.map((item) => {
            const fallback = DEFAULT_DISHES.find(
              (d) => d.category.toLowerCase() === item.category.toLowerCase() || d.name.toLowerCase().includes(item.name.toLowerCase())
            ) || DEFAULT_DISHES[0];

            return {
              ...item,
              image: item.image || fallback.image,
              rating: item.rating || fallback.rating || 4.8,
              reviewsCount: item.reviewsCount || fallback.reviewsCount || 150,
            };
          });
          setDishes(enriched);
        }
      })
      .catch(() => {
        // Keeps DEFAULT_DISHES with local photography
      });
  }, []);

  // Filtered dishes
  const filteredDishes = useMemo(() => {
    return dishes.filter((dish) => {
      // Category filter
      const matchesCategory =
        selectedCategory === 'All' ||
        dish.category.toLowerCase() === selectedCategory.toLowerCase();

      // Diet filter
      const matchesDiet =
        dietFilter === 'all' ||
        (dish.dietary && dish.dietary.includes(dietFilter));

      // Search query
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        dish.name.toLowerCase().includes(q) ||
        (dish.description && dish.description.toLowerCase().includes(q)) ||
        dish.category.toLowerCase().includes(q);

      return matchesCategory && matchesDiet && matchesSearch;
    });
  }, [dishes, selectedCategory, dietFilter, searchQuery]);

  // Card quantity stepper
  const getItemQty = (dishId) => quantities[dishId] || 1;
  const updateQty = (dishId, delta) => {
    setQuantities((prev) => ({
      ...prev,
      [dishId]: Math.max(1, Math.min(20, (prev[dishId] || 1) + delta)),
    }));
  };

  // Add to cart handler
  const handleAddToCart = (dish) => {
    const qty = getItemQty(dish._id);
    addItem({
      menuItem: dish._id,
      name: dish.name,
      image: dish.image,
      price: dish.price,
      quantity: qty,
      addOns: [],
      spiceLevel: '',
      note: '',
    });
    toast(`Added ${qty} × ${dish.name} to cart!`, 'success');
  };

  // Quick order placement in sidebar
  const handlePlaceOrder = () => {
    if (cartItems.length === 0) {
      toast('Your cart is empty. Add food items to order!', 'error');
      return;
    }

    const orderNum = 'RP-' + Math.floor(1000 + Math.random() * 9000);
    const newOrder = {
      orderNumber: orderNum,
      type: orderType,
      table: selectedTable,
      items: cartItems,
      subtotal,
      total: subtotal + Math.round(subtotal * 0.05),
      stepIndex: 0, // Order Confirmed
      createdAt: new Date(),
    };

    setActiveOrder(newOrder);
    clearCart();
    toast(`Order #${orderNum} placed successfully!`, 'success');
    setShowTrackingModal(true);
  };

  // Pricing calculations
  const gst = Math.round(subtotal * 0.05);
  const deliveryFee = orderType === 'delivery' ? (subtotal > 500 ? 0 : 40) : 0;
  const grandTotal = subtotal + gst + deliveryFee;

  return (
    <div className="restaurant-dashboard-wrapper">
      {/* Modern Dashboard Header Bar (foodslice style) */}
      <div className="dashboard-subbar">
        <div className="container spread" style={{ padding: '16px 20px' }}>
          {/* Search bar with filter button */}
          <div className="dashboard-search-container">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="dashboard-search-input"
              placeholder="Search biryani, pizza, burger, alfaham, starters, drinks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="search-clear-btn" onClick={() => setSearchQuery('')}>✕</button>
            )}
          </div>

          {/* Quick Actions */}
          <div className="topbar-actions">
            <button
              className="btn btn-outline-coral"
              onClick={() => setShowReservationModal(true)}
            >
              📅 Book a Table
            </button>

            <button
              className="btn btn-ghost-coral"
              onClick={() => setShowTrackingModal(true)}
            >
              📍 Track Order {activeOrder && <span className="live-dot" />}
            </button>

            <button
              className="cart-trigger-btn"
              onClick={() => {
                const el = document.getElementById('order-invoice-sidebar');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              title="Cart items"
            >
              🛒 My Order <span className="cart-pill-count">{count}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Container Layout: Left Content (Categories + Grid) & Right Sidebar (Invoice / Cart) */}
      <div className="container dashboard-main-content">
        <div className="dashboard-left-panel">
          {/* Hero Banner Promo */}
          <div className="dashboard-hero-banner">
            <div className="hero-banner-content">
              <span className="banner-kicker">🔥 SPECIAL OFFERS THIS WEEK</span>
              <h1>Authentic Flavors, Delivered Fresh to Your Table</h1>
              <p>Explore mouth-watering gourmet dishes, slow-dum biryanis, smoky Arabian Alfaham, and woodfired pizzas.</p>
              <div className="banner-actions">
                <button
                  className="btn btn-accent"
                  onClick={() => setSelectedCategory('Biryani')}
                >
                  Explore Biryanis →
                </button>
                <button
                  className="btn btn-white-pill"
                  onClick={() => setShowReservationModal(true)}
                >
                  Book a Table Now
                </button>
              </div>
            </div>
            <div className="hero-banner-art">
              <img
                src="/images/food/chicken-biryani.jpg"
                alt="Featured Biryani"
                className="banner-float-img"
              />
            </div>
          </div>

          {/* Explore Food Categories Section */}
          <div className="categories-section">
            <div className="spread" style={{ marginBottom: '14px' }}>
              <div>
                <h2 className="section-heading">Explore Categories</h2>
                <span className="muted small">Select a category to view dishes</span>
              </div>
              <div className="diet-filter-chips">
                {['all', 'veg', 'non-veg'].map((diet) => (
                  <button
                    key={diet}
                    className={`diet-chip ${dietFilter === diet ? 'active' : ''}`}
                    onClick={() => setDietFilter(diet)}
                  >
                    {diet === 'all' ? 'All Diets' : diet === 'veg' ? '🟢 Veg' : '🔴 Non-Veg'}
                  </button>
                ))}
              </div>
            </div>

            <div className="categories-carousel">
              {FOOD_CATEGORIES.map((cat) => {
                const isActive = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    className={`category-pill-card ${isActive ? 'active' : ''}`}
                    onClick={() => setSelectedCategory(cat.id)}
                  >
                    <div className="category-img-box">
                      <img src={cat.image} alt={cat.name} />
                    </div>
                    <span className="category-pill-name">{cat.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dishes Grid */}
          <div className="dishes-section">
            <div className="spread" style={{ marginBottom: '16px' }}>
              <div>
                <h2 className="section-heading">
                  {selectedCategory === 'All' ? 'Popular Dishes' : `${selectedCategory} Specials`}
                </h2>
                <span className="muted small">Showing {filteredDishes.length} freshly prepared items</span>
              </div>
            </div>

            {filteredDishes.length === 0 ? (
              <div className="empty-dishes-state">
                <p>No dishes found matching your search.</p>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => { setSelectedCategory('All'); setSearchQuery(''); setDietFilter('all'); }}
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="food-cards-grid">
                {filteredDishes.map((dish) => {
                  const qty = getItemQty(dish._id);
                  const isVeg = dish.dietary && dish.dietary.includes('veg');

                  return (
                    <div key={dish._id} className="food-card">
                      {/* Food Photo Container */}
                      <div className="food-card-img-wrapper">
                        <img
                          src={dish.image || '/images/food/chicken-biryani.jpg'}
                          alt={dish.name}
                          className="food-photo"
                          loading="lazy"
                        />
                        <div className="food-card-floating-tags">
                          <span className={`diet-indicator ${isVeg ? 'veg' : 'non-veg'}`}>
                            {isVeg ? '🟢 Veg' : '🔴 Non-Veg'}
                          </span>
                          {dish.isSpecial && (
                            <span className="special-tag">⭐ Chef's Special</span>
                          )}
                        </div>
                        <div className="rating-pill">
                          ★ {dish.rating || 4.8} <small>({dish.reviewsCount || 120})</small>
                        </div>
                      </div>

                      {/* Food Details */}
                      <div className="food-card-body">
                        <h3 className="food-title">{dish.name}</h3>
                        <p className="food-description">{dish.description}</p>
                        
                        <div className="food-prep-row">
                          <span className="prep-time">⏱️ {dish.prepTime || 20} mins</span>
                          <span className="category-tag">{dish.category}</span>
                        </div>

                        {/* Price & Quantity & Add Button */}
                        <div className="food-card-action-bar">
                          <div className="food-price-box">
                            <span className="food-price-val">{money(dish.price)}</span>
                          </div>

                          <div className="food-stepper-box">
                            <button
                              type="button"
                              className="qty-btn"
                              onClick={() => updateQty(dish._id, -1)}
                              aria-label="Decrease quantity"
                            >
                              −
                            </button>
                            <span className="qty-count">{qty}</span>
                            <button
                              type="button"
                              className="qty-btn"
                              onClick={() => updateQty(dish._id, 1)}
                              aria-label="Increase quantity"
                            >
                              +
                            </button>
                          </div>

                          <button
                            type="button"
                            className="btn btn-add-cart"
                            onClick={() => handleAddToCart(dish)}
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar: Active Invoice / Order Summary (foodslice style) */}
        <div id="order-invoice-sidebar" className="dashboard-right-sidebar">
          <div className="invoice-card">
            {/* Invoice Header */}
            <div className="invoice-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Invoice / My Order</h3>
                <span className="muted small">{count} item(s) selected</span>
              </div>
              {cartItems.length > 0 && (
                <button className="link-btn small danger" onClick={clearCart}>Clear</button>
              )}
            </div>

            {/* Dining Mode Selector (Dine-in, Delivery, Parcel) */}
            <div className="order-mode-tabs">
              <button
                type="button"
                className={`mode-tab ${orderType === 'dine-in' ? 'active' : ''}`}
                onClick={() => setOrderType('dine-in')}
              >
                🍽️ Dine-in
              </button>
              <button
                type="button"
                className={`mode-tab ${orderType === 'takeaway' ? 'active' : ''}`}
                onClick={() => setOrderType('takeaway')}
              >
                📦 Takeaway
              </button>
              <button
                type="button"
                className={`mode-tab ${orderType === 'delivery' ? 'active' : ''}`}
                onClick={() => setOrderType('delivery')}
              >
                🛵 Delivery
              </button>
            </div>

            {/* Table Selector for Dine-in */}
            {orderType === 'dine-in' && (
              <div className="field" style={{ margin: '12px 0' }}>
                <label className="small muted">Dining Table Allocation</label>
                <select
                  value={selectedTable}
                  onChange={(e) => setSelectedTable(e.target.value)}
                  className="table-dropdown"
                >
                  <option value="Table 1 (Window)">Table 1 • Window View (2 Seats)</option>
                  <option value="Table 2 (Window)">Table 2 • Window View (2 Seats)</option>
                  <option value="Table 3 (Indoor)">Table 3 • Main Hall (4 Seats)</option>
                  <option value="Table 4 (Indoor)">Table 4 • Main Hall (4 Seats)</option>
                  <option value="Table 5 (Indoor)">Table 5 • Quiet Alcove (4 Seats)</option>
                  <option value="Table 6 (Window)">Table 6 • Window View (4 Seats)</option>
                  <option value="Table 7 (Outdoor)">Table 7 • Garden Terrace (6 Seats)</option>
                  <option value="Table 8 (Indoor)">Table 8 • Family Lounge (6 Seats)</option>
                  <option value="Table 10 (VIP)">Table 10 • VIP Corner (8 Seats)</option>
                </select>
              </div>
            )}

            {/* Cart Items List */}
            <div className="invoice-items-list">
              {cartItems.length === 0 ? (
                <div className="empty-cart-state">
                  <span style={{ fontSize: '2.5rem', display: 'block', margin: '12px 0' }}>🛒</span>
                  <p>Your order is empty</p>
                  <small className="muted">Add food items from the menu to start your order.</small>
                </div>
              ) : (
                cartItems.map((item) => (
                  <div key={item.key} className="invoice-item-row">
                    <img
                      src={item.image || '/images/food/chicken-biryani.jpg'}
                      alt={item.name}
                      className="invoice-thumb"
                    />
                    <div className="invoice-item-details">
                      <strong className="invoice-dish-name">{item.name}</strong>
                      <span className="invoice-dish-price">{money(item.price)} each</span>
                      <div className="invoice-stepper">
                        <button
                          type="button"
                          className="stepper-mini-btn"
                          onClick={() => setQuantity(item.key, item.quantity - 1)}
                        >
                          −
                        </button>
                        <span>{item.quantity}</span>
                        <button
                          type="button"
                          className="stepper-mini-btn"
                          onClick={() => setQuantity(item.key, item.quantity + 1)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <div className="invoice-line-total">
                      <strong>{money(item.price * item.quantity)}</strong>
                      <button
                        className="delete-item-btn"
                        onClick={() => setQuantity(item.key, 0)}
                        title="Remove item"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Bill Payment Summary */}
            <div className="invoice-summary-box">
              <div className="spread small muted" style={{ margin: '6px 0' }}>
                <span>Subtotal ({count} items)</span>
                <span>{money(subtotal)}</span>
              </div>
              <div className="spread small muted" style={{ margin: '6px 0' }}>
                <span>GST (5%)</span>
                <span>{money(gst)}</span>
              </div>
              {orderType === 'delivery' && (
                <div className="spread small muted" style={{ margin: '6px 0' }}>
                  <span>Delivery Charge</span>
                  <span>{deliveryFee === 0 ? 'FREE' : money(deliveryFee)}</span>
                </div>
              )}
              <hr />
              <div className="spread total-row">
                <span>Total Payment</span>
                <span className="total-amount">{money(grandTotal)}</span>
              </div>

              {/* Checkout / Order Button */}
              <button
                type="button"
                className="btn btn-accent btn-block order-submit-btn"
                disabled={cartItems.length === 0}
                onClick={handlePlaceOrder}
              >
                Place An Order Now • {money(grandTotal)}
              </button>

              {/* Live Order Tracking Trigger */}
              {activeOrder && (
                <div className="active-order-quick-box" onClick={() => setShowTrackingModal(true)}>
                  <div className="spread">
                    <div>
                      <small className="muted">Active Order</small>
                      <strong>#{activeOrder.orderNumber}</strong>
                    </div>
                    <span className="badge tone-amber">In Kitchen 👨‍🍳</span>
                  </div>
                  <p className="small muted" style={{ margin: '4px 0 0' }}>
                    Tap to track order timeline →
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showReservationModal && (
        <TableReservationModal onClose={() => setShowReservationModal(false)} />
      )}

      {showTrackingModal && (
        <OrderTrackingModal
          initialOrder={activeOrder}
          onClose={() => setShowTrackingModal(false)}
        />
      )}
    </div>
  );
}
