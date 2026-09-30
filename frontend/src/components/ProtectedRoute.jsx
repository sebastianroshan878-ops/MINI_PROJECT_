import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// Wrap a page in <ProtectedRoute> to require login. Pass roles={[...]} to limit it to some roles.
export default function ProtectedRoute({ roles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="splash"><p>Loading...</p></div>;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  if (roles && !roles.includes(user.role)) {
    return (
      <div className="container page">
        <div className="alert alert-red">You do not have permission to open this page.</div>
      </div>
    );
  }
  return children;
}
