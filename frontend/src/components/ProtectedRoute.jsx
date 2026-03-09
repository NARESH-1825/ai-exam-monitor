// frontend/src/components/ProtectedRoute.jsx
import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children, role }) => {
  const { isAuthenticated, user } = useSelector(state => state.auth);

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (role && user?.role !== role) {
    return <Navigate to={user?.role === 'student' ? '/student' : '/faculty'} replace />;
  }

  return children;
};

export default ProtectedRoute;
