import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);

  // When the page loads, use the saved token to find out who is logged in.
  useEffect(() => {
    if (!localStorage.getItem('token')) {
      setLoading(false);
      return;
    }
    api
      .get('/auth/me')
      .then((data) => {
        setUser(data.user);
        setCustomer(data.customer);
      })
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false));
  }, []);

  function saveSession(data) {
    localStorage.setItem('token', data.token);
    setUser(data.user);
    setCustomer(data.customer || null);
  }

  async function login(email, password) {
    const data = await api.post('/auth/login', { email, password });
    saveSession(data);
    return data.user;
  }

  async function register(form) {
    const data = await api.post('/auth/register', form);
    saveSession(data);
    return data.user;
  }

  function logout() {
    localStorage.removeItem('token');
    setUser(null);
    setCustomer(null);
  }

  // Reload the customer profile (e.g. after loyalty points change)
  async function refreshCustomer() {
    if (user && user.role === 'customer') setCustomer(await api.get('/customers/me'));
  }

  const isStaff = !!user && user.role !== 'customer';

  return (
    <AuthContext.Provider value={{ user, customer, loading, isStaff, login, register, logout, refreshCustomer, setCustomer }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
