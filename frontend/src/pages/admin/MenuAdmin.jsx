import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { useConfig } from '../../context/ConfigContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import Modal from '../../components/Modal.jsx';
import { money } from '../../utils.js';

const DIET_OPTIONS = ['veg', 'non-veg', 'vegan', 'gluten-free'];
const EMOJIS = ['🍽️', '🍕', '🍔', '🍜', '🍛', '🍲', '🥗', '🍢', '🍚', '🫓', '🍡', '🍨', '🍵', '🥤', '🍤', '🐟', '🍗', '🧀'];

function emptyForm(config) {
  const defaultCat = (config?.menuCategories && config.menuCategories[0]) || 'Biryani';
  return {
    name: '',
    description: '',
    category: defaultCat,
    price: '',
    image: '',
    emoji: '🍽️',
    dietary: ['veg'],
    hasSpiceLevel: false,
    addOns: [],
    prepTime: 15,
    stock: 50,
    isAvailable: true,
    isSpecial: false,
  };
}

function ItemForm({ item, onClose, onSaved }) {
  const config = useConfig();
  const toast = useToast();
  const [form, setForm] = useState(
    item
      ? { ...item, image: item.image || '', addOns: item.addOns || [] }
      : emptyForm(config)
  );
  const [customCategory, setCustomCategory] = useState('');
  const [isCustomCat, setIsCustomCat] = useState(false);
  const [error, setError] = useState('');

  const availableCategories = [
    'Biryani',
    'Pizza',
    'Burger',
    'Alfaham',
    'Pasta',
    'Fried Rice',
    'Noodles',
    'Shawarma',
    'Fried Chicken',
    'Starters',
    'Desserts',
    'Ice Cream',
    'Drinks',
    ...(config?.menuCategories || []),
  ];
  const uniqueCategories = [...new Set(availableCategories)];

  const toggleDiet = (d) =>
    setForm((f) => ({
      ...f,
      dietary: f.dietary.includes(d) ? f.dietary.filter((x) => x !== d) : [...f.dietary, d],
    }));
  const addAddOn = () => setForm((f) => ({ ...f, addOns: [...f.addOns, { name: '', price: 0 }] }));
  const setAddOn = (i, key, value) =>
    setForm((f) => ({ ...f, addOns: f.addOns.map((a, idx) => (idx === i ? { ...a, [key]: value } : a)) }));
  const removeAddOn = (i) => setForm((f) => ({ ...f, addOns: f.addOns.filter((_, idx) => idx !== i) }));

  async function submit(e) {
    e.preventDefault();
    setError('');
    const finalName = form.name.trim();
    if (!finalName) return setError('Enter a dish name');
    if (!form.price || Number(form.price) < 1) return setError('Enter a valid price');

    const finalCategory = isCustomCat && customCategory.trim() ? customCategory.trim() : form.category;
    if (!finalCategory) return setError('Select or enter a category');

    const payload = {
      ...form,
      name: finalName,
      category: finalCategory,
      price: Number(form.price),
      image: form.image.trim(),
    };

    try {
      if (item && item._id) await api.put(`/menu/${item._id}`, payload);
      else await api.post('/menu', payload);
      toast(item ? 'Dish updated successfully' : 'Dish added to menu', 'success');
      onSaved();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Modal title={item ? 'Edit dish' : 'Add dish'} onClose={onClose} wide>
      <form onSubmit={submit} className="stack">
        <div className="form-grid">
          <div className="field">
            <label>Food Name *</label>
            <input
              required
              placeholder="e.g. Pista Ice Cream"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Price (₹) *</label>
            <input
              type="number"
              min={1}
              required
              placeholder="e.g. 120"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
          </div>
        </div>

        <div className="field">
          <label>Food Image URL or Path</label>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input
              style={{ flex: 1 }}
              placeholder="e.g. https://images.unsplash.com/... or /images/food/dish.jpg"
              value={form.image}
              onChange={(e) => setForm({ ...form, image: e.target.value })}
            />
            {form.image && (
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '6px',
                  overflow: 'hidden',
                  border: '1px solid #cbd5e1',
                  flexShrink: 0,
                }}
              >
                <img
                  src={form.image}
                  alt="Preview"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>
          <span className="small muted">Provide a direct high-quality photo URL for this specific dish.</span>
        </div>

        <div className="field">
          <label>Description</label>
          <textarea
            rows={2}
            placeholder="Short culinary description of ingredients and preparation..."
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>

        <div className="form-grid">
          <div className="field">
            <label>Category *</label>
            {!isCustomCat ? (
              <div style={{ display: 'flex', gap: '8px' }}>
                <select
                  style={{ flex: 1 }}
                  value={form.category}
                  onChange={(e) => {
                    if (e.target.value === '__NEW__') {
                      setIsCustomCat(true);
                    } else {
                      setForm({ ...form, category: e.target.value });
                    }
                  }}
                >
                  {uniqueCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                  <option value="__NEW__">+ Add Custom Category...</option>
                </select>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  style={{ flex: 1 }}
                  placeholder="Enter new category name..."
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  autoFocus
                />
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => setIsCustomCat(false)}
                >
                  Choose existing
                </button>
              </div>
            )}
          </div>
          <div className="field">
            <label>Emoji Badge</label>
            <select
              value={form.emoji}
              onChange={(e) => setForm({ ...form, emoji: e.target.value })}
            >
              {EMOJIS.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-grid">
          <div className="field">
            <label>Prep time (minutes)</label>
            <input
              type="number"
              min={1}
              value={form.prepTime}
              onChange={(e) => setForm({ ...form, prepTime: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Stock (portions today)</label>
            <input
              type="number"
              min={0}
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: e.target.value })}
            />
          </div>
        </div>

        <div className="field">
          <label>Dietary tags</label>
          <div className="chip-row">
            {DIET_OPTIONS.map((d) => (
              <button
                type="button"
                key={d}
                className={`chip ${form.dietary.includes(d) ? 'active' : ''}`}
                onClick={() => toggleDiet(d)}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={form.isAvailable}
            onChange={(e) => setForm({ ...form, isAvailable: e.target.checked })}
          />{' '}
          Available for ordering
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={form.isSpecial}
            onChange={(e) => setForm({ ...form, isSpecial: e.target.checked })}
          />{' '}
          Show as chef's special on the home page
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={form.hasSpiceLevel}
            onChange={(e) => setForm({ ...form, hasSpiceLevel: e.target.checked })}
          />{' '}
          Let guests choose a spice level
        </label>

        <div className="field">
          <label>Add-ons (optional)</label>
          {form.addOns.map((a, i) => (
            <div key={i} className="form-grid addon-row">
              <input
                placeholder="Name"
                value={a.name}
                onChange={(e) => setAddOn(i, 'name', e.target.value)}
              />
              <input
                type="number"
                placeholder="Price"
                min={0}
                value={a.price}
                onChange={(e) => setAddOn(i, 'price', Number(e.target.value))}
              />
              <button
                type="button"
                className="link-btn danger"
                onClick={() => removeAddOn(i)}
              >
                Remove
              </button>
            </div>
          ))}
          <button type="button" className="link-btn" onClick={addAddOn}>
            + Add option
          </button>
        </div>

        {error && <div className="alert alert-red">{error}</div>}
        <button className="btn btn-primary btn-block">
          {item ? 'Save changes' : 'Add dish'}
        </button>
      </form>
    </Modal>
  );
}

export default function MenuAdmin() {
  const { user } = useAuth();
  const canEditFull = ['admin', 'manager'].includes(user.role);
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [formOpen, setFormOpen] = useState(null);
  const [search, setSearch] = useState('');

  const load = () => api.get('/menu').then(setItems);
  useEffect(load, []);

  async function toggleAvailable(item) {
    await api.patch(`/menu/${item._id}/availability`, { isAvailable: !item.isAvailable });
    load();
  }
  async function setStock(item, stock) {
    await api.patch(`/menu/${item._id}/availability`, { stock });
    load();
  }
  async function remove(item) {
    if (!confirm(`Delete ${item.name}?`)) return;
    try {
      await api.delete(`/menu/${item._id}`);
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  const filtered = items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="stack">
      <div className="spread">
        <h1>Menu</h1>
        {canEditFull && <button className="btn btn-primary" onClick={() => setFormOpen(true)}>+ Add dish</button>}
      </div>
      <input className="search-input" placeholder="Search dishes..." value={search} onChange={(e) => setSearch(e.target.value)} />

      <div className="table-scroll">
        <table className="data-table">
          <thead><tr><th></th><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th>Available</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item._id} className={!item.isAvailable ? 'muted-row' : ''}>
                <td>{item.emoji}</td>
                <td>{item.name}{item.isSpecial && <Badge />}</td>
                <td>{item.category}</td>
                <td>{money(item.price)}</td>
                <td><input type="number" min={0} value={item.stock} className="stock-input" onChange={(e) => setStock(item, Number(e.target.value))} /></td>
                <td><input type="checkbox" checked={item.isAvailable} onChange={() => toggleAvailable(item)} /></td>
                <td>
                  <div className="row-actions">
                    {canEditFull && <button className="link-btn" onClick={() => setFormOpen(item)}>Edit</button>}
                    {canEditFull && <button className="link-btn danger" onClick={() => remove(item)}>Delete</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {formOpen && <ItemForm item={formOpen === true ? null : formOpen} onClose={() => setFormOpen(null)} onSaved={() => { setFormOpen(null); load(); }} />}
    </div>
  );
}

function Badge() { return <span className="badge tone-amber" style={{ marginLeft: 6 }}>Special</span>; }
