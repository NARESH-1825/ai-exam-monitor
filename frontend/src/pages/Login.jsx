// frontend/src/pages/Login.jsx
import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { loginUser } from '../features/auth/authSlice';
import api from '../services/api';
import { toast } from 'react-toastify';

const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
  return re.test(email) ? '' : 'Enter a valid email address';
};

const validatePassword = (password) => {
  if (password.length < 8) return 'At least 8 characters required';
  if (!/[0-9]/.test(password)) return 'Must contain a number';
  if (!/[!@#$%^&*()_+\-=\[\]{};\':"\\|,.<>\/?]/.test(password)) return 'Must contain a special character';
  if (!/[A-Z]/.test(password)) return 'Must contain an uppercase letter';
  return '';
};

const PasswordStrength = ({ password }) => {
  if (!password) return null;
  let score = 0;
  if (password.length >= 8) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[!@#$%^&*()_+\-=\[\]{};\':"\\|,.<>\/?]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (password.length >= 12) score++;
  const labels = ['', 'Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];
  const colors  = ['', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500'];
  const texts   = ['', 'text-red-400', 'text-orange-400', 'text-yellow-400', 'text-blue-400', 'text-green-400'];
  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= score ? colors[score] : 'bg-gray-600'}`} />
        ))}
      </div>
      <p className={`text-xs ${texts[score]}`}>{labels[score]}</p>
    </div>
  );
};

const inputCls = (err, touched) =>
  `w-full bg-gray-800/80 text-white px-4 py-3 rounded-xl outline-none border transition-all text-sm
   ${touched && err ? 'border-red-500 focus:border-red-400' : 'border-gray-700 focus:border-blue-500'}`;

const Login = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error, isAuthenticated, user } = useSelector(state => state.auth);

  const [tab, setTab]               = useState('login');
  const [form, setForm]             = useState({ name: '', email: '', password: '', role: 'student', rollNumber: '', department: '' });
  const [regLoading, setRegLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [touched, setTouched]       = useState({});
  const [showPw, setShowPw]         = useState(false);

  useEffect(() => {
    if (isAuthenticated && user) navigate(user.role === 'student' ? '/student' : '/faculty', { replace: true });
  }, [isAuthenticated, user]);

  const validateField = (field, value) => {
    let err = '';
    if (field === 'email')    err = validateEmail(value);
    if (field === 'password') err = validatePassword(value);
    if (field === 'name' && !value.trim()) err = 'Name is required';
    setFieldErrors(p => ({ ...p, [field]: err }));
    return err;
  };

  const handleChange = (field, value) => {
    setForm(p => ({ ...p, [field]: value }));
    if (touched[field]) validateField(field, value);
  };

  const handleBlur = (field) => {
    setTouched(p => ({ ...p, [field]: true }));
    validateField(field, form[field]);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const emailErr = validateEmail(form.email);
    if (emailErr) { toast.error(emailErr, { className: 'custom-toast', bodyClassName: 'custom-toast-body' }); return; }
    const result = await dispatch(loginUser({ email: form.email, password: form.password }));
    if (result.meta.requestStatus === 'fulfilled') {
      const role = result.payload.user.role;
      toast.success(`Welcome back, ${result.payload.user.name}!`, { className: 'custom-toast', bodyClassName: 'custom-toast-body' });
      navigate(role === 'student' ? '/student' : '/faculty', { replace: true });
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    const nameErr = !form.name.trim() ? 'Name is required' : '';
    const emailErr = validateEmail(form.email);
    const passErr  = validatePassword(form.password);
    setFieldErrors({ name: nameErr, email: emailErr, password: passErr });
    setTouched({ name: true, email: true, password: true });
    if (nameErr || emailErr || passErr) { toast.error('Please fix the validation errors', { className: 'custom-toast', bodyClassName: 'custom-toast-body' }); return; }
    setRegLoading(true);
    try {
      await api.post('/auth/register', form);
      toast.success('Account created! You can now log in.', { className: 'custom-toast', bodyClassName: 'custom-toast-body' });
      setTab('login');
      setForm(p => ({ ...p, name: '', password: '', rollNumber: '', department: '' }));
      setFieldErrors({}); setTouched({});
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed', { className: 'custom-toast', bodyClassName: 'custom-toast-body' });
    }
    setRegLoading(false);
  };

  const features = [
    { icon: '👁️', text: 'Real-time AI face detection' },
    { icon: '🔒', text: 'Browser lockdown & anti-cheat' },
    { icon: '📊', text: 'Live faculty monitoring' },
    { icon: '⚡', text: 'Instant WebSocket alerts' },
  ];

  return (
    <div className="login-page min-h-screen flex">

      {/* ── Left Panel (branding) — hidden on small screens ── */}
      <div className="hidden lg:flex flex-col justify-between w-2/5 bg-gradient-to-br from-blue-950 via-gray-900 to-purple-950 p-12 border-r border-white/5">
        <div>
          <Link to="/" className="flex items-center gap-2.5 mb-16">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">🎓</div>
            <span className="font-bold text-white text-lg">AI Exam Monitor</span>
          </Link>

          <h2 className="text-3xl font-extrabold text-white mb-3 leading-tight">
            The smartest way to<br/>
            <span className="gradient-text">conduct exams</span>
          </h2>
          <p className="text-gray-400 text-sm mb-10 leading-relaxed">
            Six AI proctors working together to ensure integrity at any scale — for students and faculty.
          </p>

          <div className="space-y-4">
            {features.map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-900/50 border border-blue-800/40 flex items-center justify-center text-sm flex-shrink-0">
                  {f.icon}
                </div>
                <span className="text-gray-300 text-sm">{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-gray-700 text-xs">© 2024 AI Exam Monitor · Secure · Proctored · Real-time</p>
      </div>

      {/* ── Right Panel (form) ── */}
      <div className="flex-1 flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden justify-center">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">🎓</div>
            <span className="font-bold text-white text-lg">AI Exam Monitor</span>
          </div>

          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white">{tab === 'login' ? 'Welcome back' : 'Create account'}</h1>
            <p className="text-gray-400 text-sm mt-1">
              {tab === 'login' ? 'Sign in to continue to your dashboard' : 'Join the platform and start monitoring'}
            </p>
          </div>

          {/* Security note */}
          <div className="bg-blue-900/20 border border-blue-800/50 rounded-xl p-3 mb-5 text-xs text-blue-300 flex items-center gap-2">
            🔒 Single-device session enforced. Logging in ends any other active session.
          </div>

          {/* Tab switcher */}
          <div className="flex bg-gray-800/60 border border-gray-700/50 rounded-xl p-1 mb-6 gap-1">
            {['login', 'register'].map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setFieldErrors({}); setTouched({}); }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all capitalize
                  ${tab === t ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
              >
                {t === 'login' ? '🔑 Sign In' : '📝 Register'}
              </button>
            ))}
          </div>

          {/* ── Login Form ── */}
          {tab === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4 fade-in">
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block font-medium">Email Address</label>
                <input
                  type="email" required placeholder="your@email.com"
                  value={form.email}
                  onChange={e => handleChange('email', e.target.value)}
                  onBlur={() => handleBlur('email')}
                  className={inputCls(fieldErrors.email, touched.email)}
                />
                {touched.email && fieldErrors.email && <p className="text-red-400 text-xs mt-1">⚠ {fieldErrors.email}</p>}
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block font-medium">Password</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'} required placeholder="••••••••"
                    value={form.password}
                    onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                    className="w-full bg-gray-800/80 text-white px-4 py-3 rounded-xl outline-none border border-gray-700 focus:border-blue-500 transition-all text-sm pr-10"
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-sm">
                    {showPw ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>
              {error && (
                <div className="bg-red-900/30 border border-red-700/60 rounded-xl p-3 text-red-300 text-sm">⚠️ {error}</div>
              )}
              <button
                type="submit" disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all text-sm shadow-lg shadow-blue-900/30 hover:shadow-blue-900/50"
              >
                {loading
                  ? <span className="flex items-center justify-center gap-2"><span className="animate-spin">⚙️</span> Signing in...</span>
                  : 'Sign In →'
                }
              </button>
            </form>
          ) : (
            /* ── Register Form ── */
            <form onSubmit={handleRegister} className="space-y-4 fade-in">
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block font-medium">Full Name</label>
                <input required placeholder="John Smith" value={form.name}
                  onChange={e => handleChange('name', e.target.value)}
                  onBlur={() => handleBlur('name')}
                  className={inputCls(fieldErrors.name, touched.name)} />
                {touched.name && fieldErrors.name && <p className="text-red-400 text-xs mt-1">⚠ {fieldErrors.name}</p>}
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block font-medium">Email Address</label>
                <input type="email" required placeholder="your@email.com" value={form.email}
                  onChange={e => handleChange('email', e.target.value)}
                  onBlur={() => handleBlur('email')}
                  className={inputCls(fieldErrors.email, touched.email)} />
                {touched.email && fieldErrors.email && <p className="text-red-400 text-xs mt-1">⚠ {fieldErrors.email}</p>}
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block font-medium">
                  Password <span className="text-gray-600">(8+ chars, uppercase, number, special)</span>
                </label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} required placeholder="••••••••" value={form.password}
                    onChange={e => handleChange('password', e.target.value)}
                    onBlur={() => handleBlur('password')}
                    className={`${inputCls(fieldErrors.password, touched.password)} pr-10`} />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-sm">
                    {showPw ? '🙈' : '👁️'}
                  </button>
                </div>
                <PasswordStrength password={form.password} />
                {touched.password && fieldErrors.password && <p className="text-red-400 text-xs mt-1">⚠ {fieldErrors.password}</p>}
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block font-medium">Role</label>
                <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                  className="w-full bg-gray-800/80 text-white px-4 py-3 rounded-xl outline-none border border-gray-700 focus:border-blue-500 transition-all text-sm">
                  <option value="student">🎓 Student</option>
                  <option value="faculty">👨‍🏫 Faculty / Teacher</option>
                </select>
              </div>
              {form.role === 'student' && (
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block font-medium">Roll Number</label>
                  <input placeholder="CS2024001" value={form.rollNumber}
                    onChange={e => setForm(p => ({ ...p, rollNumber: e.target.value }))}
                    className="w-full bg-gray-800/80 text-white px-4 py-3 rounded-xl outline-none border border-gray-700 focus:border-blue-500 transition-all text-sm" />
                </div>
              )}
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block font-medium">Department <span className="text-gray-600">(optional)</span></label>
                <input placeholder="Computer Science" value={form.department}
                  onChange={e => setForm(p => ({ ...p, department: e.target.value }))}
                  className="w-full bg-gray-800/80 text-white px-4 py-3 rounded-xl outline-none border border-gray-700 focus:border-blue-500 transition-all text-sm" />
              </div>
              <button type="submit" disabled={regLoading}
                className="w-full py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all text-sm shadow-lg">
                {regLoading ? '⚙️ Creating account...' : 'Create Account →'}
              </button>
            </form>
          )}

          <p className="text-center text-gray-600 text-xs mt-6">
            © 2024 AI Exam Monitor · <Link to="/" className="text-blue-500 hover:underline">Back to Home</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
