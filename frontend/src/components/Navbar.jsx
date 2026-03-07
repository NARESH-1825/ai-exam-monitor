// frontend/src/components/Navbar.jsx
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { logoutUser } from '../features/auth/authSlice';
import { toast } from 'react-toastify';

const Navbar = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector(state => state.auth);

  const handleLogout = async () => {
    await dispatch(logoutUser());
    toast.info('Logged out successfully');
    navigate('/login', { replace: true });
  };

  return (
    <nav className="bg-[#0f172a] border-b border-white/6 px-6 py-3 flex justify-between items-center sticky top-0 z-50">
      <Link to={user?.role === 'faculty' ? '/faculty' : '/student'}
        className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm">🎓</div>
        <span className="text-white font-bold text-base hidden sm:block">AI Exam Monitor</span>
      </Link>
      <div className="flex items-center gap-3">
        <div className="hidden sm:block text-right">
          <p className="text-white text-sm font-semibold">{user?.name}</p>
          <p className="text-gray-500 text-xs capitalize">{user?.role}{user?.rollNumber && ` · ${user.rollNumber}`}</p>
        </div>
        <button onClick={handleLogout}
          className="text-xs px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white rounded-lg transition-colors font-medium">
          🚪 Logout
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
