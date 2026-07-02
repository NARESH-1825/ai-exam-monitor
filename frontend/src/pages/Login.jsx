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

  // New state variables for OTP and password reset
  const [isVerifyingRegOtp, setIsVerifyingRegOtp] = useState(false);
  const [regOtpCode, setRegOtpCode] = useState('');
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [resetPasswordStep, setResetPasswordStep] = useState('');
  const [resetForm, setResetForm] = useState({ email: '', otp: '', newPassword: '', confirmNewPassword: '' });
  const [resetLoading, setResetLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  // Concurrent session state
  const [concurrentSession, setConcurrentSession] = useState(false);
  const [concurrentOtp, setConcurrentOtp] = useState('');
  const [concurrentLoading, setConcurrentLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

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
    setLoginLoading(true);
    try {
      const deviceInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
      // Call API directly (not Redux) so we can inspect the response code
      const { data } = await api.post('/auth/login', { email: form.email, password: form.password, deviceInfo });

      if (data.code === 'CONCURRENT_SESSION_DETECTED') {
        // Active session on another device — show authorization screen
        toast.warning('⚠️ Active session detected! Check your email for an authorization code.', {
          autoClose: 6000,
          className: 'custom-toast',
        });
        setConcurrentSession(true);
        setLoginLoading(false);
        return;
      }

      // Normal login — store token and update Redux
      localStorage.setItem('token', data.token);
      localStorage.setItem('authUser', JSON.stringify(data.user));
      localStorage.setItem('auth_event', JSON.stringify({ type: 'LOGIN', ts: Date.now() }));
      dispatch({ type: 'auth/login/fulfilled', payload: data });
      toast.success(`Welcome back, ${data.user.name}!`, { className: 'custom-toast', bodyClassName: 'custom-toast-body' });
      navigate(data.user.role === 'student' ? '/student' : '/faculty', { replace: true });
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed';
      toast.error(msg, { className: 'custom-toast', bodyClassName: 'custom-toast-body' });
    }
    setLoginLoading(false);
  };

  const handleConfirmConcurrentLogin = async (e) => {
    e.preventDefault();
    if (concurrentOtp.length !== 6) {
      toast.error('Authorization code must be 6 digits', { className: 'custom-toast', bodyClassName: 'custom-toast-body' });
      return;
    }
    setConcurrentLoading(true);
    try {
      const deviceInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
      const { data } = await api.post('/auth/confirm-concurrent-login', {
        email: form.email,
        password: form.password,
        otp: concurrentOtp,
        deviceInfo,
      });
      // Success — the old device's Firestore listener fires and kicks them to landing page
      localStorage.setItem('token', data.token);
      localStorage.setItem('authUser', JSON.stringify(data.user));
      localStorage.setItem('auth_event', JSON.stringify({ type: 'LOGIN', ts: Date.now() }));
      dispatch({ type: 'auth/login/fulfilled', payload: data });
      toast.success(`Welcome back, ${data.user.name}! Previous session has been terminated.`, {
        className: 'custom-toast',
        autoClose: 4000,
      });
      navigate(data.user.role === 'student' ? '/student' : '/faculty', { replace: true });
    } catch (err) {
      const msg = err.response?.data?.message || 'Authorization failed';
      if (err.response?.data?.code === 'CONCURRENT_OTP_EXPIRED') {
        // Code expired — reset back to login
        setConcurrentSession(false);
        setConcurrentOtp('');
      }
      toast.error(msg, { className: 'custom-toast', bodyClassName: 'custom-toast-body' });
    }
    setConcurrentLoading(false);
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
      toast.success('Verification code sent to your email!', { className: 'custom-toast', bodyClassName: 'custom-toast-body' });
      setIsVerifyingRegOtp(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed', { className: 'custom-toast', bodyClassName: 'custom-toast-body' });
    }
    setRegLoading(false);
  };

  const handleVerifyRegOtp = async (e) => {
    e.preventDefault();
    if (regOtpCode.length !== 6) {
      toast.error('OTP code must be 6 digits', { className: 'custom-toast', bodyClassName: 'custom-toast-body' });
      return;
    }
    setVerificationLoading(true);
    try {
      await api.post('/auth/verify-otp', {
        email: form.email,
        otp: regOtpCode,
        type: 'register'
      });
      toast.success('Registration successful! You can now log in.', { className: 'custom-toast', bodyClassName: 'custom-toast-body' });
      setIsVerifyingRegOtp(false);
      setRegOtpCode('');
      setTab('login');
      setForm(p => ({ ...p, name: '', password: '', rollNumber: '', department: '' }));
      setFieldErrors({});
      setTouched({});
    } catch (err) {
      toast.error(err.response?.data?.message || 'Verification failed', { className: 'custom-toast', bodyClassName: 'custom-toast-body' });
    }
    setVerificationLoading(false);
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    const emailErr = validateEmail(forgotPasswordEmail);
    if (emailErr) {
      toast.error(emailErr, { className: 'custom-toast', bodyClassName: 'custom-toast-body' });
      return;
    }
    setResetLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: forgotPasswordEmail });
      toast.success('Password reset code sent to your email!', { className: 'custom-toast', bodyClassName: 'custom-toast-body' });
      setResetPasswordStep('verify');
      setResetForm(p => ({ ...p, email: forgotPasswordEmail }));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send reset code', { className: 'custom-toast', bodyClassName: 'custom-toast-body' });
    }
    setResetLoading(false);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (resetForm.otp.length !== 6) {
      toast.error('Verification code must be 6 digits', { className: 'custom-toast', bodyClassName: 'custom-toast-body' });
      return;
    }
    const passErr = validatePassword(resetForm.newPassword);
    if (passErr) {
      toast.error(`New password: ${passErr}`, { className: 'custom-toast', bodyClassName: 'custom-toast-body' });
      return;
    }
    if (resetForm.newPassword !== resetForm.confirmNewPassword) {
      toast.error('Passwords do not match', { className: 'custom-toast', bodyClassName: 'custom-toast-body' });
      return;
    }
    setResetLoading(true);
    try {
      await api.post('/auth/reset-password', {
        email: resetForm.email,
        otp: resetForm.otp,
        newPassword: resetForm.newPassword
      });
      toast.success('Password reset successfully! Please log in.', { className: 'custom-toast', bodyClassName: 'custom-toast-body' });
      setTab('login');
      setResetPasswordStep('');
      setResetForm({ email: '', otp: '', newPassword: '', confirmNewPassword: '' });
      setForgotPasswordEmail('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Password reset failed', { className: 'custom-toast', bodyClassName: 'custom-toast-body' });
    }
    setResetLoading(false);
  };

  const handleResendOtp = async (type) => {
    // Pick correct email source for each type
    const email = type === 'register' || type === 'concurrent_login'
      ? form.email
      : resetForm.email;
    if (!email) return;
    setResendLoading(true);
    try {
      await api.post('/auth/resend-otp', { email, type });
      toast.success('A new OTP has been sent to your email.', { className: 'custom-toast', bodyClassName: 'custom-toast-body' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Resend failed', { className: 'custom-toast', bodyClassName: 'custom-toast-body' });
    }
    setResendLoading(false);
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
            <h1 className="text-2xl font-bold text-white">
              {tab === 'login' ? 'Welcome back' : tab === 'register' ? 'Create account' : 'Reset Password'}
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              {tab === 'login'
                ? 'Sign in to continue to your dashboard'
                : tab === 'register'
                ? 'Join the platform and start monitoring'
                : 'Follow the steps to recover your account'
              }
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
                onClick={() => {
                  setTab(t);
                  setFieldErrors({});
                  setTouched({});
                  setIsVerifyingRegOtp(false);
                  setResetPasswordStep('');
                }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all capitalize
                  ${tab === t ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
              >
                {t === 'login' ? '🔑 Sign In' : '📝 Register'}
              </button>
            ))}
          </div>

          {/* ── Login Form ── */}
          {tab === 'login' && !concurrentSession && (
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
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs text-gray-400 block font-medium">Password</label>
                  <button
                    type="button"
                    onClick={() => { setTab('forgot-password'); setResetPasswordStep('forgot'); }}
                    className="text-xs text-blue-500 hover:underline hover:text-blue-400 font-medium"
                  >
                    Forgot Password?
                  </button>
                </div>
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
                type="submit" disabled={loginLoading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all text-sm shadow-lg shadow-blue-900/30 hover:shadow-blue-900/50"
              >
                {loginLoading
                  ? <span className="flex items-center justify-center gap-2"><span className="animate-spin">⚙️</span> Signing in...</span>
                  : 'Sign In →'
                }
              </button>
            </form>
          )}

          {/* ── Concurrent Session — Authorization Required ── */}
          {tab === 'login' && concurrentSession && (
            <form onSubmit={handleConfirmConcurrentLogin} className="space-y-4 fade-in">
              <div className="bg-orange-900/20 border border-orange-700/60 rounded-xl p-4">
                <p className="text-orange-300 text-sm font-semibold mb-1">⚠️ Active Session Detected</p>
                <p className="text-orange-200/70 text-xs leading-relaxed">
                  Your account is already logged in on another device. An authorization code has been sent to <strong className="text-white">{form.email}</strong>.
                  Submitting the code will <strong>terminate the existing session</strong> and log you in here.
                </p>
              </div>
              <div className="bg-yellow-900/10 border border-yellow-800/40 rounded-xl p-3 text-yellow-300/70 text-xs flex items-center gap-2">
                ⏱️ This code expires in <strong className="text-yellow-200">3 minutes</strong>. If not verified, this login attempt will be cancelled.
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block font-medium">Authorization Code</label>
                <input
                  type="text" required maxLength="6" placeholder="123456"
                  value={concurrentOtp}
                  onChange={e => setConcurrentOtp(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-gray-800/80 text-white px-4 py-3 rounded-xl outline-none border border-orange-700/60 focus:border-orange-500 transition-all text-sm tracking-widest text-center text-xl font-bold"
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={resendLoading}
                  onClick={() => handleResendOtp('concurrent_login')}
                  className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white font-medium rounded-xl transition-all text-sm border border-gray-700"
                >
                  {resendLoading ? 'Sending...' : '🔄 Resend'}
                </button>
                <button
                  type="submit"
                  disabled={concurrentLoading}
                  className="flex-[2] py-3 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all text-sm shadow-lg shadow-orange-900/30"
                >
                  {concurrentLoading ? 'Authorizing...' : 'Authorize New Login →'}
                </button>
              </div>
              <button
                type="button"
                onClick={() => { setConcurrentSession(false); setConcurrentOtp(''); }}
                className="w-full text-center text-xs text-gray-400 hover:text-white transition-all underline"
              >
                ← Cancel and go back
              </button>
            </form>
          )}

          {/* ── Register Form (Step 1: Details) ── */}
          {tab === 'register' && !isVerifyingRegOtp && (
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

          {/* ── Register Form (Step 2: OTP Verification) ── */}
          {tab === 'register' && isVerifyingRegOtp && (
            <form onSubmit={handleVerifyRegOtp} className="space-y-4 fade-in">
              <div className="bg-blue-900/20 border border-blue-800/50 rounded-xl p-4 text-xs text-blue-300">
                📧 We sent a 6-digit verification code to <strong className="text-white">{form.email}</strong>. Please check your inbox.
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block font-medium">Verification Code</label>
                <input
                  type="text" required maxLength="6" placeholder="123456"
                  value={regOtpCode}
                  onChange={e => setRegOtpCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-gray-800/80 text-white px-4 py-3 rounded-xl outline-none border border-gray-700 focus:border-blue-500 transition-all text-sm tracking-widest text-center text-lg font-bold"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={resendLoading}
                  onClick={() => handleResendOtp('register')}
                  className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white font-medium rounded-xl transition-all text-sm border border-gray-705"
                >
                  {resendLoading ? 'Sending...' : '🔄 Resend'}
                </button>
                <button
                  type="submit"
                  disabled={verificationLoading}
                  className="flex-[2] py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all text-sm shadow-lg shadow-blue-900/30"
                >
                  {verificationLoading ? 'Verifying...' : 'Verify & Register →'}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setIsVerifyingRegOtp(false)}
                className="w-full text-center text-xs text-gray-400 hover:text-white transition-all underline"
              >
                ← Back to registration details
              </button>
            </form>
          )}

          {/* ── Forgot Password Form (Step 1: Enter Email) ── */}
          {tab === 'forgot-password' && resetPasswordStep === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-4 fade-in">
              <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-4 text-xs text-gray-400">
                Enter your registered email address below, and we will send you a 6-digit OTP code to reset your password.
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block font-medium">Email Address</label>
                <input
                  type="email" required placeholder="your@email.com"
                  value={forgotPasswordEmail}
                  onChange={e => setForgotPasswordEmail(e.target.value)}
                  className="w-full bg-gray-800/80 text-white px-4 py-3 rounded-xl outline-none border border-gray-700 focus:border-blue-500 transition-all text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={resetLoading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all text-sm shadow-lg shadow-blue-900/30"
              >
                {resetLoading ? 'Sending Code...' : 'Send Reset Code →'}
              </button>
              <button
                type="button"
                onClick={() => { setTab('login'); setResetPasswordStep(''); }}
                className="w-full text-center text-xs text-gray-400 hover:text-white transition-all underline"
              >
                ← Back to Sign In
              </button>
            </form>
          )}

          {/* ── Forgot Password Form (Step 2: Verify OTP & New Password) ── */}
          {tab === 'forgot-password' && resetPasswordStep === 'verify' && (
            <form onSubmit={handleResetPassword} className="space-y-4 fade-in">
              <div className="bg-blue-900/20 border border-blue-800/50 rounded-xl p-4 text-xs text-blue-300">
                📧 We sent a reset code to <strong className="text-white">{resetForm.email}</strong>. Enter it below along with your new password.
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block font-medium">Verification Code</label>
                <input
                  type="text" required maxLength="6" placeholder="123456"
                  value={resetForm.otp}
                  onChange={e => setResetForm(p => ({ ...p, otp: e.target.value.replace(/\D/g, '') }))}
                  className="w-full bg-gray-800/80 text-white px-4 py-3 rounded-xl outline-none border border-gray-700 focus:border-blue-500 transition-all text-sm tracking-widest text-center text-lg font-bold"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block font-medium">New Password</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'} required placeholder="••••••••"
                    value={resetForm.newPassword}
                    onChange={e => setResetForm(p => ({ ...p, newPassword: e.target.value }))}
                    className="w-full bg-gray-800/80 text-white px-4 py-3 rounded-xl outline-none border border-gray-700 focus:border-blue-500 transition-all text-sm pr-10"
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-sm">
                    {showPw ? '🙈' : '👁️'}
                  </button>
                </div>
                <PasswordStrength password={resetForm.newPassword} />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block font-medium">Confirm New Password</label>
                <input
                  type={showPw ? 'text' : 'password'} required placeholder="••••••••"
                  value={resetForm.confirmNewPassword}
                  onChange={e => setResetForm(p => ({ ...p, confirmNewPassword: e.target.value }))}
                  className="w-full bg-gray-800/80 text-white px-4 py-3 rounded-xl outline-none border border-gray-700 focus:border-blue-500 transition-all text-sm"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={resendLoading}
                  onClick={() => handleResendOtp('password_reset')}
                  className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white font-medium rounded-xl transition-all text-sm border border-gray-707"
                >
                  {resendLoading ? 'Sending...' : '🔄 Resend'}
                </button>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="flex-[2] py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all text-sm shadow-lg shadow-blue-900/30"
                >
                  {resetLoading ? 'Resetting...' : 'Reset Password →'}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setResetPasswordStep('forgot')}
                className="w-full text-center text-xs text-gray-400 hover:text-white transition-all underline"
              >
                ← Back to enter email
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
