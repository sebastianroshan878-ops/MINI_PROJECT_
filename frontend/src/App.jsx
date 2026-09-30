import { Routes, Route } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';

import PublicLayout from './components/PublicLayout.jsx';
import AdminLayout from './components/AdminLayout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

import Home from './pages/Home.jsx';
import Menu from './pages/Menu.jsx';
import Cart from './pages/Cart.jsx';
import Checkout from './pages/Checkout.jsx';
import Reserve from './pages/Reserve.jsx';
import TrackOrder from './pages/TrackOrder.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Profile from './pages/Profile.jsx';
import MyOrders from './pages/MyOrders.jsx';

import Dashboard from './pages/admin/Dashboard.jsx';
import Tables from './pages/admin/Tables.jsx';
import Reservations from './pages/admin/Reservations.jsx';
import Orders from './pages/admin/Orders.jsx';
import MenuAdmin from './pages/admin/MenuAdmin.jsx';
import Customers from './pages/admin/Customers.jsx';
import Payments from './pages/admin/Payments.jsx';
import FeedbackAdmin from './pages/admin/Feedback.jsx';
import Staff from './pages/admin/Staff.jsx';
import MyWork from './pages/admin/MyWork.jsx';

const STAFF_ROLES = ['admin', 'manager', 'waiter', 'chef', 'delivery'];

export default function App() {
  const { loading } = useAuth();
  if (loading) return <div className="splash"><p>Loading LUMORA...</p></div>;

  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/menu" element={<Menu />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/reserve" element={<Reserve />} />
        <Route path="/reservations" element={<Reserve />} />
        <Route path="/orders" element={<MyOrders />} />
        <Route path="/track" element={<TrackOrder />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/profile" element={<ProtectedRoute roles={['customer']}><Profile /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Route>

      <Route
        path="/admin"
        element={<ProtectedRoute roles={STAFF_ROLES}><AdminLayout /></ProtectedRoute>}
      >
        <Route index element={<RoleGate roles={['admin', 'manager']}><Dashboard /></RoleGate>} />
        <Route path="tables" element={<RoleGate roles={['admin', 'manager', 'waiter']}><Tables /></RoleGate>} />
        <Route path="reservations" element={<RoleGate roles={['admin', 'manager', 'waiter']}><Reservations /></RoleGate>} />
        <Route path="orders" element={<Orders />} />
        <Route path="menu" element={<RoleGate roles={['admin', 'manager', 'chef']}><MenuAdmin /></RoleGate>} />
        <Route path="customers" element={<RoleGate roles={['admin', 'manager', 'waiter']}><Customers /></RoleGate>} />
        <Route path="payments" element={<RoleGate roles={['admin', 'manager']}><Payments /></RoleGate>} />
        <Route path="feedback" element={<RoleGate roles={['admin', 'manager']}><FeedbackAdmin /></RoleGate>} />
        <Route path="staff" element={<RoleGate roles={['admin', 'manager']}><Staff /></RoleGate>} />
        <Route path="my-work" element={<MyWork />} />
      </Route>
    </Routes>
  );
}

// Hides a page from staff roles that are not allowed to see it, and sends them to Orders instead.
function RoleGate({ roles, children }) {
  const { user } = useAuth();
  if (!roles.includes(user.role)) {
    return <div className="alert alert-red">You do not have permission to open this page.</div>;
  }
  return children;
}

function NotFound() {
  return (
    <div className="container page center-text">
      <h1>Page not found</h1>
      <p className="muted">The page you're looking for doesn't exist.</p>
    </div>
  );
}
