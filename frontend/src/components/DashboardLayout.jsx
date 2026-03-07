// frontend/src/components/DashboardLayout.jsx
import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logoutUser } from '../features/auth/authSlice';
import { toast } from 'react-toastify';

/* ── Nav config ────────────────────────────────────────────────── */
const STUDENT_NAV = [
  { to: '/student',             icon: '🏠', label: 'Dashboard'   },
  { to: '/student/assessments', icon: '📝', label: 'Assessments' },
];

const FACULTY_NAV = [
  { to: '/faculty',             icon: '🏠', label: 'Dashboard'   },
  { to: '/faculty/questions',   icon: '📚', label: 'Question Bank' },
  { to: '/faculty/exam-config', icon: '⚙️', label: 'Create Exam' },
  { to: '/faculty/students',    icon: '👥', label: 'Students'    },
];

/* ── Sidebar item ──────────────────────────────────────────────── */
const NavItem = ({ to, icon, label, collapsed, onClick }) => {
  const { pathname } = useLocation();
  const isActive = pathname === to || (to !== '/student' && to !== '/faculty' && pathname.startsWith(to));

  return (
    <Link
      to={to}
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl mx-2 mb-1 text-sm font-medium transition-all duration-200 group
        ${isActive
          ? 'bg-blue-600/20 text-blue-400 border border-blue-600/25'
          : 'text-gray-400 hover:text-white hover:bg-white/4 border border-transparent'
        }`}
    >
      <span className="text-lg shrink-0 w-6 text-center">{icon}</span>
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
};

/* ── Profile Modal ─────────────────────────────────────────────── */
const ProfileModal = ({ user, onClose }) => (
  <div
    className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 fade-in"
    onClick={onClose}
  >
    <div
      className="bg-gray-800 rounded-2xl p-7 max-w-sm w-full shadow-2xl border border-slate-700/30 fade-in-scale"
      onClick={e => e.stopPropagation()}
    >
      <div className="text-center mb-5">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl font-bold mx-auto mb-3 shadow-lg">
          {user?.name?.[0]?.toUpperCase() || '?'}
        </div>
        <h2 className="text-lg font-bold text-white">{user?.name}</h2>
        <p className="text-gray-400 text-sm capitalize mt-0.5">{user?.role}</p>
      </div>
      <div className="space-y-2.5">
        {[
          { label: 'Email',       value: user?.email,      icon: '📧' },
          { label: 'Roll Number', value: user?.rollNumber, icon: '🎓' },
          { label: 'Department',  value: user?.department, icon: '🏛️' },
        ].filter(f => f.value).map((f, i) => (
          <div key={i} className="flex items-center gap-3 bg-white/4 rounded-xl px-4 py-3 border border-slate-700/20">
            <span>{f.icon}</span>
            <div>
              <p className="text-xs text-gray-400">{f.label}</p>
              <p className="text-white text-sm font-medium">{f.value}</p>
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={onClose}
        className="w-full mt-5 py-2.5 bg-gray-700/80 hover:bg-gray-600 rounded-xl text-sm font-medium transition-colors border border-slate-600/30"
      >
        Close
      </button>
    </div>
  </div>
);

/* ── Main Layout ───────────────────────────────────────────────── */
const DashboardLayout = ({ children, title, actions }) => {
  const dispatch  = useDispatch();
  const navigate  = useNavigate();
  const { user }  = useSelector(state => state.auth);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const navLinks  = user?.role === 'faculty' ? FACULTY_NAV : STUDENT_NAV;

  const handleLogout = async () => {
    await dispatch(logoutUser());
    toast.info('Logged out successfully');
    navigate('/login', { replace: true });
  };

  const sidebarContent = (onLinkClick) => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`flex items-center gap-2.5 px-4 py-4 border-b border-slate-700/20 ${collapsed ? 'justify-center' : ''}`}>
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm shrink-0">
          🎓
        </div>
        {!collapsed && (
          <div>
            <p className="font-bold text-white text-sm leading-tight">AI Exam</p>
            <p className="text-gray-500 text-xs">Monitor</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {navLinks.map(item => (
          <NavItem key={item.to} {...item} collapsed={collapsed} onClick={onLinkClick} />
        ))}
      </nav>

      {/* User + Logout */}
      <div className={`border-t border-slate-700/20 p-3 ${collapsed ? 'flex flex-col items-center gap-2' : ''}`}>
        {!collapsed && (
          <div className="flex items-center gap-2.5 px-2 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm font-bold shrink-0">
              {user?.name?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="min-w-0">
              <p className="text-white text-xs font-semibold truncate">{user?.name}</p>
              <p className="text-gray-500 text-xs capitalize">{user?.role}</p>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          title="Logout"
          className={`flex items-center gap-2 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg px-2 py-2 transition-colors w-full ${collapsed ? 'justify-center' : ''}`}
        >
          <span className="text-base">🚪</span>
          {!collapsed && 'Logout'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="dashboard-root">
      {/* ── Desktop Sidebar ─── */}
      <aside
        className={`dashboard-sidebar sidebar-transition hidden md:flex flex-col ${collapsed ? 'w-16' : 'w-56'}`}
      >
        {sidebarContent(undefined)}
        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="absolute top-4 left-0 z-50 hidden md:flex"
          style={{ left: collapsed ? 52 : 212, transition: 'left 0.25s cubic-bezier(0.4,0,0.2,1)' }}
        >
          <span className="w-5 h-5 rounded-full bg-gray-700 border border-slate-600/40 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-600 text-xs shadow-lg">
            {collapsed ? '›' : '‹'}
          </span>
        </button>
      </aside>

      {/* ── Mobile Sidebar Overlay ─── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative z-10 w-56 dashboard-sidebar flex flex-col slide-in-right">
            {sidebarContent(() => setMobileOpen(false))}
          </aside>
        </div>
      )}

      {/* ── Main ─── */}
      <div className="dashboard-main">
        {/* Top Bar */}
        <header className="dashboard-topbar flex items-center justify-between px-4 py-3 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden text-gray-400 hover:text-white text-xl"
            >
              ☰
            </button>
            {/* Title */}
            <div>
              <h1 className="text-white font-semibold text-sm sm:text-base truncate">
                {title || 'Dashboard'}
              </h1>
            </div>
          </div>

          {/* Actions slot + user pill */}
          <div className="flex items-center gap-2 shrink-0">
            {actions}
            {/* Desktop clickable user pill */}
            <div
              className="hidden md:flex items-center gap-2 bg-white/4 border border-slate-700/25 rounded-xl px-3 py-1.5 profile-pill"
              onClick={() => setProfileOpen(true)}
              title="View Profile"
            >
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs font-bold">
                {user?.name?.[0]?.toUpperCase() || '?'}
              </div>
              <span className="text-white text-xs font-medium">{user?.name}</span>
              <span className="text-gray-500 text-xs capitalize">· {user?.role}</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="dashboard-content">
          {children}
        </main>

        {/* ── Mobile Bottom Nav ─── */}
        <nav className="md:hidden flex border-t border-slate-700/20 bg-gray-900/95 backdrop-blur shrink-0">
          {navLinks.map(({ to, icon, label }) => {
            const { pathname } = { pathname: window.location.pathname };
            const isActive = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`flex-1 flex flex-col items-center justify-center py-2.5 text-xs gap-0.5 transition-colors
                  ${isActive ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'}`}
              >
                <span className="text-lg">{icon}</span>
                <span className="font-medium">{label}</span>
              </Link>
            );
          })}
          <button
            onClick={handleLogout}
            className="flex-1 flex flex-col items-center justify-center py-2.5 text-xs gap-0.5 text-red-400 hover:text-red-300 transition-colors"
          >
            <span className="text-lg">🚪</span>
            <span className="font-medium">Logout</span>
          </button>
        </nav>
      </div>

      {/* ── Profile Modal (faculty & student both can see) ─── */}
      {profileOpen && <ProfileModal user={user} onClose={() => setProfileOpen(false)} />}
    </div>
  );
};

export default DashboardLayout;
