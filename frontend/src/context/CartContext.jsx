import { createContext, useContext, useEffect, useState } from 'react';

const CartContext = createContext(null);

// The shopping cart is kept in the browser (localStorage) so it survives a page refresh.
export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('cart')) || [];
    } catch (err) {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(items));
  }, [items]);

  // The same dish with different options (spice, add-ons, note) is a different cart line.
  const makeKey = (line) =>
    [line.menuItem, line.addOns.map((a) => a.name).sort().join('+'), line.spiceLevel || '', line.note || ''].join('|');

  function addItem(line) {
    const key = makeKey(line);
    setItems((list) => {
      const found = list.find((i) => i.key === key);
      if (found) return list.map((i) => (i.key === key ? { ...i, quantity: Math.min(20, i.quantity + line.quantity) } : i));
      return [...list, { ...line, key }];
    });
  }

  function setQuantity(key, quantity) {
    setItems((list) => (quantity < 1 ? list.filter((i) => i.key !== key) : list.map((i) => (i.key === key ? { ...i, quantity: Math.min(20, quantity) } : i))));
  }

  const [activeReservation, setActiveReservation] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('lumora_active_reservation')) || null;
    } catch (err) {
      return null;
    }
  });

  useEffect(() => {
    if (activeReservation) {
      localStorage.setItem('lumora_active_reservation', JSON.stringify(activeReservation));
    } else {
      localStorage.removeItem('lumora_active_reservation');
    }
  }, [activeReservation]);

  const clearActiveReservation = () => setActiveReservation(null);

  const clear = () => setItems([]);
  const unitPrice = (i) => i.price + i.addOns.reduce((s, a) => s + a.price, 0);
  const subtotal = items.reduce((s, i) => s + unitPrice(i) * i.quantity, 0);
  const count = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        setQuantity,
        clear,
        subtotal,
        count,
        unitPrice,
        activeReservation,
        setActiveReservation,
        clearActiveReservation,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
