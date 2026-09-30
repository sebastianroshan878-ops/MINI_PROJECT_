import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useConfig } from '../context/ConfigContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import Modal from '../components/Modal.jsx';
import { FOOD_CATEGORIES, DEFAULT_DISHES } from '../constants.js';
import { money } from '../utils.js';

const DIET_ICON = { veg: '🟢 Veg', 'non-veg': '🔴 Non-Veg', vegan: '🌱 Vegan', 'gluten-free': '🌾 Gluten-Free' };

function DishModal({ dish, onClose }) {
  const { addItem } = useCart();
  const toast = useToast();
  const [quantity, setQuantity] = useState(1);
  const [addOns, setAddOns] = useState([]);
  const [spiceLevel, setSpiceLevel] = useState('medium');
  const [note, setNote] = useState('');

  const toggleAddOn = (name) =>
    setAddOns((list) => (list.includes(name) ? list.filter((n) => n !== name) : [...list, name]));

  const dishAddOns = dish.addOns || [];
  const selectedAddOns = dishAddOns.filter((a) => addOns.includes(a.name));
  const unitPrice = dish.price + selectedAddOns.reduce((s, a) => s + a.price, 0);

  function add() {
    addItem({
      menuItem: dish._id,
      name: dish.name,
      image: dish.image,
      emoji: dish.emoji,
      price: dish.price,
      quantity,
      addOns: selectedAddOns,
      spiceLevel: dish.hasSpiceLevel ? spiceLevel : '',
      note: note.trim(),
    });
    toast(`${quantity} × ${dish.name} added to cart`, 'success');
    onClose();
  }

  return (
    <Modal title={dish.name} onClose={onClose}>
      {dish.image && (
        <div className="dish-modal-img-wrapper">
          <img
            src={dish.image}
            alt={dish.name}
            className="dish-modal-img"
            onError={(e) => {
              e.target.src = '/images/food/chicken-biryani.jpg';
            }}
          />
        </div>
      )}
      <p style={{ marginTop: '8px' }}>{dish.description}</p>
      <div className="spread small muted" style={{ margin: '8px 0 14px' }}>
        <span>{dish.dietary?.map((d) => DIET_ICON[d] || d).join(' • ')}</span>
        <span>⏱️ {dish.prepTime || 20} mins prep</span>
      </div>

      {dish.hasSpiceLevel && (
        <div className="field">
          <label>Spice level</label>
          <div className="tabs">
            {['mild', 'medium', 'hot'].map((s) => (
              <button
                type="button"
                key={s}
                className={`tab ${spiceLevel === s ? 'active' : ''}`}
                onClick={() => setSpiceLevel(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {dishAddOns.length > 0 && (
        <div className="field">
          <label>Custom Extras / Add-ons</label>
          {dishAddOns.map((a) => (
            <label key={a.name} className="checkbox-row" style={{ cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={addOns.includes(a.name)}
                onChange={() => toggleAddOn(a.name)}
              />
              {a.name} (+{money(a.price)})
            </label>
          ))}
        </div>
      )}

      <div className="field">
        <label htmlFor="modal-note">Special kitchen instructions (optional)</label>
        <input
          id="modal-note"
          maxLength={120}
          placeholder="e.g. less spicy, cutlery please"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <div className="spread" style={{ marginTop: '16px' }}>
        <div className="qty-stepper">
          <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} aria-label="Decrease">−</button>
          <span>{quantity}</span>
          <button type="button" onClick={() => setQuantity((q) => Math.min(20, q + 1))} aria-label="Increase">+</button>
        </div>
        <button className="btn btn-primary" onClick={add}>
          Add to Cart • {money(unitPrice * quantity)}
        </button>
      </div>
    </Modal>
  );
}

export default function Menu() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { addItem, count, activeReservation, clearActiveReservation } = useCart();
  const toast = useToast();

  const [allDishes, setAllDishes] = useState(DEFAULT_DISHES);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState('All');
  const [diet, setDiet] = useState('all');
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [quantities, setQuantities] = useState({});
  const [open, setOpen] = useState(null);

  // Sync search param if URL changes
  useEffect(() => {
    const urlQuery = searchParams.get('search');
    if (urlQuery !== null && urlQuery !== search) {
      setSearch(urlQuery);
    }
  }, [searchParams]);

  // Fetch real menu from backend with graceful fallback
  useEffect(() => {
    setLoading(true);
    api.get('/menu')
      .then((serverItems) => {
        if (Array.isArray(serverItems) && serverItems.length > 0) {
          const enriched = serverItems.map((item) => {
            const itemName = (item.name || '').toLowerCase();
            const fallback = DEFAULT_DISHES.find(
              (d) => d.name.toLowerCase() === itemName
            ) || DEFAULT_DISHES.find(
              (d) => d.category.toLowerCase() === (item.category || '').toLowerCase()
            ) || DEFAULT_DISHES[0];

            return {
              ...item,
              image: item.image || fallback.image,
              rating: item.rating || fallback.rating || 4.8,
              reviewsCount: item.reviewsCount || fallback.reviewsCount || 150,
            };
          });
          setAllDishes(enriched);
        }
      })
      .catch((err) => {
        console.warn('Using default menu items:', err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  // Filtered dishes memo
  const filteredDishes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allDishes.filter((dish) => {
      // Category filter - strict isolation
      const dc = (dish.category || '').trim().toLowerCase();
      const sc = category.trim().toLowerCase();
      let matchesCategory = false;
      if (sc === 'all') {
        matchesCategory = true;
      } else if (sc === 'burger' || sc === 'burgers') {
        matchesCategory = dc === 'burger' || dc === 'burgers';
      } else if (sc === 'drinks' || sc === 'beverages') {
        matchesCategory = dc === 'drinks' || dc === 'beverages';
      } else if (sc === 'biryani') {
        matchesCategory = dc === 'biryani' || dc === 'biryani & rice';
      } else {
        matchesCategory = dc === sc;
      }

      // Diet filter
      const matchesDiet =
        diet === 'all' || (Array.isArray(dish.dietary) && dish.dietary.includes(diet));

      // Search query filter across name, description, category and tags
      const matchesSearch =
        !q ||
        dish.name.toLowerCase().includes(q) ||
        (dish.description && dish.description.toLowerCase().includes(q)) ||
        dish.category.toLowerCase().includes(q) ||
        (Array.isArray(dish.dietary) && dish.dietary.some((tag) => tag.toLowerCase().includes(q)));

      return matchesCategory && matchesDiet && matchesSearch;
    });
  }, [allDishes, category, diet, search]);

  // Group filtered dishes by category
  const grouped = useMemo(() => {
    const map = new Map();
    filteredDishes.forEach((item) => {
      if (!map.has(item.category)) map.set(item.category, []);
      map.get(item.category).push(item);
    });
    return map;
  }, [filteredDishes]);

  const getQty = (dishId) => quantities[dishId] || 1;
  const updateQty = (dishId, delta) => {
    setQuantities((prev) => ({
      ...prev,
      [dishId]: Math.max(1, Math.min(20, (prev[dishId] || 1) + delta)),
    }));
  };

  function quickAdd(dish) {
    if (dish.hasSpiceLevel || (dish.addOns && dish.addOns.length > 0)) {
      return setOpen(dish);
    }
    const qty = getQty(dish._id);
    addItem({
      menuItem: dish._id,
      name: dish.name,
      image: dish.image,
      emoji: dish.emoji,
      price: dish.price,
      quantity: qty,
      addOns: [],
      spiceLevel: '',
      note: '',
    });
    toast(`Added ${qty} × ${dish.name} to cart!`, 'success');
  }

  return (
    <div className="container page">
      {/* Active Table Reservation Banner */}
      {activeReservation && (
        <div className="active-table-banner">
          <div className="active-table-info">
            <span className="table-badge-icon">🍽️</span>
            <div>
              <strong>Ordering Food for Table {activeReservation.tableNumber}</strong>
              <p className="muted small">
                Reservation: {activeReservation.code || 'Confirmed'} • {activeReservation.date} at {activeReservation.time} ({activeReservation.guests || 2} Guests)
              </p>
            </div>
          </div>
          <div className="active-table-actions">
            <button className="btn btn-sm btn-ghost" onClick={() => navigate('/reservations')}>
              Change Table
            </button>
            <button className="btn btn-sm btn-ghost" onClick={clearActiveReservation} title="Order as delivery or parcel instead">
              ✕ Clear Table Link
            </button>
          </div>
        </div>
      )}

      {/* Page Title & View Cart Button */}
      <div className="spread" style={{ marginBottom: '20px' }}>
        <div>
          <h1>Our Menu</h1>
          <p className="muted">Explore freshly prepared gourmet dishes made with signature recipes and authentic spices.</p>
        </div>
        {count > 0 && (
          <button className="btn btn-primary" onClick={() => navigate('/cart')}>
            🛒 View Cart ({count})
          </button>
        )}
      </div>

      {/* Search Bar with RIGHT-ALIGNED search icon + Diet Filter */}
      <div className="menu-search-bar-row">
        <div className="menu-search-input-wrapper">
          <input
            className="menu-search-input-field"
            placeholder="Search dishes, biryani, pizza, burger, alfaham…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search dishes"
          />
          {search ? (
            <button className="menu-search-clear-btn" onClick={() => setSearch('')} title="Clear search">
              ✕
            </button>
          ) : null}
          <span className="menu-search-icon-right" title="Search">
            🔍
          </span>
        </div>

        <select
          className="menu-diet-select"
          value={diet}
          onChange={(e) => setDiet(e.target.value)}
          aria-label="Filter by diet"
        >
          <option value="all">All Diets</option>
          <option value="veg">🟢 Vegetarian</option>
          <option value="non-veg">🔴 Non-Vegetarian</option>
          <option value="vegan">🌱 Vegan</option>
        </select>
      </div>

      {/* Category Filter Chips with Images/Icons */}
      <div className="chip-row menu-categories-strip">
        {FOOD_CATEGORIES.map((cat) => {
          const isActive = category.toLowerCase() === cat.id.toLowerCase();
          return (
            <button
              key={cat.id}
              type="button"
              className={`chip menu-category-chip ${isActive ? 'active' : ''}`}
              onClick={() => setCategory(cat.id)}
            >
              <span className="chip-icon">{cat.icon}</span>
              <span>{cat.name}</span>
            </button>
          );
        })}
      </div>

      {loading && <p className="muted">Loading dishes...</p>}

      {/* Genuine Empty State */}
      {!loading && filteredDishes.length === 0 && (
        <div className="empty-state-card">
          <span style={{ fontSize: '2.5rem' }}>🔍</span>
          <h3>No dishes match your filters</h3>
          <p className="muted">Try clearing your search term or switching to a different category.</p>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              setSearch('');
              setCategory('All');
              setDiet('all');
            }}
          >
            Reset All Filters
          </button>
        </div>
      )}

      {/* Menu Sections by Category */}
      {[...grouped.entries()].map(([catName, dishes]) => (
        <section key={catName} className="menu-section">
          <div className="spread" style={{ marginBottom: '16px', borderBottom: '1.5px solid var(--border)', paddingBottom: '8px' }}>
            <h2 style={{ margin: 0 }}>{catName}</h2>
            <span className="muted small">{dishes.length} {dishes.length === 1 ? 'dish' : 'dishes'}</span>
          </div>

          <div className="food-cards-grid">
            {dishes.map((dish) => {
              const qty = getQty(dish._id);
              const isVeg = dish.dietary?.includes('veg');
              const isNonVeg = dish.dietary?.includes('non-veg');

              return (
                <div key={dish._id} className={`food-card ${!dish.isAvailable ? 'sold-out' : ''}`}>
                  {/* Food Card Image */}
                  <div className="food-card-img-wrapper">
                    <img
                      src={dish.image || '/images/food/chicken-biryani.jpg'}
                      alt={dish.name}
                      className="food-photo"
                      loading="lazy"
                      onError={(e) => {
                        e.target.src = '/images/food/chicken-biryani.jpg';
                      }}
                    />
                    <div className="food-card-floating-tags">
                      {isVeg && <span className="diet-indicator veg">🟢 Veg</span>}
                      {isNonVeg && <span className="diet-indicator non-veg">🔴 Non-Veg</span>}
                      {dish.isSpecial && <span className="special-tag">Chef's Choice</span>}
                    </div>
                    <div className="rating-pill">
                      <span>★</span> {dish.rating || 4.8}
                    </div>
                  </div>

                  {/* Food Card Body */}
                  <div className="food-card-body">
                    <h3 className="food-title">{dish.name}</h3>
                    <p className="food-description">{dish.description}</p>

                    <div className="food-prep-row">
                      <span className="prep-time">⏱️ {dish.prepTime || 20} mins</span>
                      <span className="category-tag">{dish.category}</span>
                    </div>

                    {/* Action Bar */}
                    <div className="food-card-action-bar">
                      <div className="food-price-val">{money(dish.price)}</div>

                      {dish.isAvailable ? (
                        <div className="food-action-controls">
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
                            className="btn-add-cart"
                            onClick={() => quickAdd(dish)}
                          >
                            Add to Cart
                          </button>
                        </div>
                      ) : (
                        <span className="badge tone-red">Sold Out</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {open && <DishModal dish={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
