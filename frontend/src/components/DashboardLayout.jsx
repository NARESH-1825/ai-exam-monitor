// frontend/src/components/DashboardLayout.jsx
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { logoutUser } from "../features/auth/authSlice";
import { toast } from "react-toastify";
import { useTheme } from "../context/ThemeContext";

/* ── Nav config ────────────────────────────────────────────────── */
const STUDENT_NAV = [
  { to: "/student",             icon: "🏠", label: "Dashboard"   },
  { to: "/student/assessments", icon: "📝", label: "Assessments" },
];
const FACULTY_NAV = [
  { to: "/faculty",              icon: "🏠", label: "Dashboard"    },
  { to: "/faculty/questions",    icon: "📚", label: "Question Bank" },
  { to: "/faculty/exam-config",  icon: "⚙️", label: "Create Exam"  },
  { to: "/faculty/students",     icon: "👥", label: "Students"     },
];

/* ── Chevron SVGs ──────────────────────────────────────────────── */
const ChevronLeft = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);
const ChevronRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

/* ── Theme definitions ─────────────────────────────────────────── */
const THEME_OPTIONS = [
  { key: "dark",    label: "Dark",    icon: "🌙", dot: "#3b82f6" },
  { key: "colored", label: "Color",   icon: "🎨", dot: "#8b5cf6" },
  { key: "light",   label: "Light",   icon: "☀️", dot: "#f59e0b" },
];

/* ── Theme switcher panel in sidebar ──────────────────────────── */
const ThemeSwitcher = ({ collapsed }) => {
  const { theme, setTheme } = useTheme();

  if (collapsed) {
    // In collapsed mode: cycle through themes on click
    const current = THEME_OPTIONS.find(t => t.key === theme) || THEME_OPTIONS[0];
    const next = THEME_OPTIONS[(THEME_OPTIONS.findIndex(t => t.key === theme) + 1) % 3];
    return (
      <button
        onClick={() => setTheme(next.key)}
        title={`Switch theme (current: ${current.label})`}
        className="w-full flex justify-center py-2 hover:bg-white/5 rounded-xl transition-colors"
      >
        <span className="text-base">{current.icon}</span>
      </button>
    );
  }

  return (
    <div className="px-3 pb-2">
      <p className="text-[9px] font-bold uppercase tracking-widest mb-1.5"
        style={{ color: 'var(--text-muted)' }}>
        Theme
      </p>
      <div className="grid grid-cols-3 gap-1">
        {THEME_OPTIONS.map(opt => (
          <button
            key={opt.key}
            onClick={() => setTheme(opt.key)}
            className={`theme-btn flex-col gap-1 py-2 px-1 justify-center ${
              theme === opt.key ? 'active-theme' : ''
            }`}
            title={opt.label}
          >
            <span className="text-base leading-none">{opt.icon}</span>
            <span className="text-[10px] leading-none">{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

/* ── Sidebar Nav Item ──────────────────────────────────────────── */
const NavItem = ({ to, icon, label, collapsed, onClick }) => {
  const { pathname } = useLocation();
  const isActive =
    pathname === to ||
    (to !== "/student" && to !== "/faculty" && pathname.startsWith(to));

  return (
    <Link
      to={to}
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={`nav-sidebar-item flex items-center gap-3 mx-2 mb-0.5
        text-sm font-medium overflow-hidden
        ${collapsed ? "px-0 py-3 justify-center" : "px-3 py-2"}
        ${isActive ? "nav-sidebar-active" : "nav-sidebar-idle"}`}
    >
      {/* Icon — no animation */}
      <span className="shrink-0 text-base">{icon}</span>
      {/* Label */}
      {!collapsed && (
        <span className="truncate leading-tight">{label}</span>
      )}
    </Link>
  );
};

/* ── Profile Modal ─────────────────────────────────────────────── */
const ProfileModal = ({ user, onClose }) => (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
    <div className="bg-gray-800 rounded-2xl p-7 max-w-sm w-full shadow-2xl border border-slate-700/30" onClick={e => e.stopPropagation()}>
      <div className="text-center mb-5">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl font-bold mx-auto mb-3 shadow-lg ring-4 ring-blue-500/20">
          {user?.name?.[0]?.toUpperCase() || "?"}
        </div>
        <h2 className="text-lg font-bold text-white">{user?.name}</h2>
        <p className="text-gray-400 text-sm capitalize mt-0.5">{user?.role}</p>
      </div>
      <div className="space-y-2.5">
        {[
          { label: "Email",       value: user?.email,       icon: "📧" },
          { label: "Roll Number", value: user?.rollNumber,  icon: "🎓" },
          { label: "Department",  value: user?.department,  icon: "🏛️" },
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
      <button onClick={onClose} className="w-full mt-5 py-2.5 bg-gray-700/80 hover:bg-gray-600 rounded-xl text-sm font-medium transition-colors border border-slate-600/30">
        Close
      </button>
    </div>
  </div>
);

/* ── Main Layout ───────────────────────────────────────────────── */
const DashboardLayout = ({ children, title, actions }) => {
  const dispatch  = useDispatch();
  const navigate  = useNavigate();
  const { user }  = useSelector(s => s.auth);
  const [collapsed,   setCollapsed]   = useState(false);
  const [mobileOpen,  setMobileOpen]  = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const navLinks = user?.role === "faculty" ? FACULTY_NAV : STUDENT_NAV;

  const handleLogout = async () => {
    await dispatch(logoutUser());
    toast.info("Logged out successfully", { className: "custom-toast", bodyClassName: "custom-toast-body" });
    navigate("/login", { replace: true });
  };

  /* ── Sidebar inner ─────────────────────────────────────────── */
  const SidebarContent = ({ onLinkClick, forMobile = false }) => (
    <div className="flex flex-col h-full">

      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 ${collapsed && !forMobile ? "justify-center px-2" : ""}`}
        style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="relative shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 flex items-center justify-center text-base shadow-lg shadow-blue-900/40 ring-2 ring-blue-500/20">
            🎓
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border-2"
            style={{ borderColor: 'var(--bg-sidebar, #0d1117)' }} />
        </div>
        {(!collapsed || forMobile) && (
          <div className="min-w-0">
            <p className="font-extrabold text-sm tracking-tight leading-tight" style={{ color: 'var(--text-primary)' }}>AI Exam</p>
            <p className="text-[10px] font-medium uppercase tracking-widest" style={{ color: 'var(--accent)' }}>Monitor</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto space-y-1">
        {(!collapsed || forMobile) && (
          <p className="text-[9px] font-bold uppercase tracking-widest px-5 mb-3" style={{ color: 'var(--text-muted)' }}>
            Navigation
          </p>
        )}
        {navLinks.map(item => (
          <NavItem key={item.to} {...item} collapsed={collapsed && !forMobile} onClick={onLinkClick} />
        ))}
      </nav>

      {/* Theme switcher — desktop only (shown in mobile drawer too) */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
        <ThemeSwitcher collapsed={collapsed && !forMobile} />
      </div>

      {/* Collapse toggle — desktop sidebar only */}
      {!forMobile && (
        <div className="px-2 pb-1">
          <button
            onClick={() => setCollapsed(c => !c)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium
              border border-transparent transition-all duration-200 group
              ${collapsed ? "justify-center" : ""}`}
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--sidebar-nav-hover-bg)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <span className="transition-transform duration-300 group-hover:scale-110">
              {collapsed ? <ChevronRight /> : <ChevronLeft />}
            </span>
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      )}

      {/* User + Logout */}
      <div className="p-3 space-y-1" style={{ borderTop: '1px solid var(--border)' }}>
        {(!collapsed || forMobile) ? (
          <div
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer transition-colors group"
            style={{ color: 'var(--text-primary)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--sidebar-nav-hover-bg)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            onClick={() => { setProfileOpen(true); if (onLinkClick) onLinkClick(); }}
            title="View profile"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs font-bold shrink-0 ring-2 ring-blue-500/20">
              {user?.name?.[0]?.toUpperCase() || "?"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{user?.name}</p>
              <p className="text-[10px] capitalize" style={{ color: 'var(--text-muted)' }}>{user?.role}</p>
            </div>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>›</span>
          </div>
        ) : (
          <button onClick={() => setProfileOpen(true)} title={user?.name}
            className="w-full flex justify-center py-2 rounded-xl transition-colors"
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--sidebar-nav-hover-bg)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-[10px] font-bold ring-2 ring-blue-500/20">
              {user?.name?.[0]?.toUpperCase() || "?"}
            </div>
          </button>
        )}

        <button
          onClick={handleLogout}
          title="Logout"
          className={`flex items-center gap-2 text-xs font-medium rounded-xl px-3 py-2 transition-all w-full border border-transparent ${collapsed && !forMobile ? "justify-center px-0" : ""}`}
          style={{ color: '#f87171' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.2)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
        >
          <span className="text-base shrink-0">🚪</span>
          {(!collapsed || forMobile) && <span>Logout</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="dashboard-root">
      {/* Desktop Sidebar */}
      <aside className={`dashboard-sidebar sidebar-transition hidden md:flex flex-col ${collapsed ? "w-16" : "w-60"}`}>
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative z-10 w-64 dashboard-sidebar flex flex-col slide-in-right">
            <SidebarContent onLinkClick={() => setMobileOpen(false)} forMobile />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="dashboard-main">
        {/* Top Bar */}
        <header className="dashboard-topbar flex items-center justify-between px-4 py-3 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--sidebar-nav-hover-bg)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6"  x2="21" y2="6"  />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <h1 className="font-semibold text-sm sm:text-base truncate" style={{ color: 'var(--text-primary)' }}>
              {title || "Dashboard"}
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {actions}
            <div
              className="hidden md:flex items-center gap-2 rounded-xl px-3 py-1.5 cursor-pointer profile-pill transition-colors border"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
              onClick={() => setProfileOpen(true)}
              title="View Profile"
            >
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs font-bold ring-1 ring-blue-500/30">
                {user?.name?.[0]?.toUpperCase() || "?"}
              </div>
              <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{user?.name}</span>
              <span className="text-xs capitalize" style={{ color: 'var(--text-muted)' }}>· {user?.role}</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="dashboard-content flex flex-col">{children}</main>

        {/* Mobile Bottom Nav — ICONS ONLY */}
        <nav className="md:hidden flex shrink-0 relative" style={{ background: 'var(--bg-sidebar, #0d1117)' }}>
          {/* Top border line */}
          <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'rgba(var(--line, 255 255 255) / 0.07)' }} />

          {navLinks.map(({ to, icon, label }) => {
            const isActive = window.location.pathname === to ||
              (to !== "/student" && to !== "/faculty" && window.location.pathname.startsWith(to));
            return (
              <Link
                key={to}
                to={to}
                title={label}
                className={`nav-bottom-item flex-1 flex flex-col items-center justify-center py-3 relative overflow-hidden
                  ${isActive ? "nav-bottom-active" : "nav-bottom-idle"}`}
              >
                {/* Active glowing top border */}
                <span
                  className={`absolute top-0 left-1/2 -translate-x-1/2 rounded-b-full transition-all duration-300
                    ${isActive ? "w-10 h-[3px] opacity-100" : "w-0 h-[3px] opacity-0"}`}
                  style={{
                    background: 'var(--accent, #3b82f6)',
                    boxShadow: isActive ? '0 0 10px 2px rgba(var(--accent, 59 130 246) / 0.6)' : 'none',
                  }}
                />
                {/* Icon */}
                <span
                  className={`text-xl transition-all duration-250
                    ${isActive ? "-translate-y-0.5 scale-115" : ""}`}
                >
                  {icon}
                </span>
                {/* Active dot */}
                <span
                  className={`w-1 h-1 rounded-full mt-0.5 transition-all duration-200
                    ${isActive ? "opacity-100 scale-100" : "opacity-0 scale-0"}`}
                  style={{ background: 'var(--accent, #3b82f6)' }}
                />
              </Link>
            );
          })}

          {/* Logout */}
          <button
            onClick={handleLogout}
            title="Logout"
            className="nav-bottom-item nav-bottom-logout flex-1 flex flex-col items-center justify-center py-3 relative overflow-hidden"
          >
            <span className="absolute top-0 left-1/2 -translate-x-1/2 w-0 h-[3px] rounded-b-full opacity-0" />
            <span className="text-xl transition-all duration-200">🚪</span>
            <span className="w-1 h-1 rounded-full mt-0.5 opacity-0" />
          </button>
        </nav>
      </div>

      {profileOpen && <ProfileModal user={user} onClose={() => setProfileOpen(false)} />}
    </div>
  );
};

export default DashboardLayout;
