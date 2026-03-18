// frontend/src/pages/Landing.jsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const features = [
  { icon: '👁️', title: 'AI Face Detection',   desc: 'Real-time face tracking with TensorFlow.js — detects multiple faces instantly.' },
  { icon: '🔒', title: 'Browser Lockdown',     desc: 'Blocks tab switching, copy/paste, DevTools, and context menus during exams.' },
  { icon: '🎤', title: 'Noise Detection',       desc: 'Audio monitoring to catch suspicious sounds in the exam environment.' },
  { icon: '📊', title: 'Live Dashboard',        desc: 'Faculty monitor every student in real-time with violation tracking.' },
  { icon: '⚡', title: 'Real-Time Alerts',      desc: 'Instant WebSocket notifications on any suspicious activity.' },
  { icon: '🛡️', title: 'Single Device Login',  desc: 'JWT session enforcement — only one active session per user.' },
];

const stats = [
  { val: '99.9%', label: 'Uptime' },
  { val: '<50ms', label: 'Alert latency' },
  { val: '6',     label: 'AI Proctors' },
  { val: '∞',     label: 'Scalability' },
];

const Landing = () => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="landing-page min-h-screen text-white">

      {/* ── Sticky Navbar ── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-gray-900/90 backdrop-blur-md border-b border-white/10 shadow-xl' : ''
      }`}>
        <div className="max-w-6xl mx-auto flex justify-between items-center px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm">🎓</div>
            <span className="font-bold text-lg">AI Exam Monitor</span>
          </div>
          <div className="flex items-center gap-3">
            <a href="#features" className="text-gray-400 hover:text-white text-sm font-medium transition-colors hidden sm:block">Features</a>
            <Link
              to="/login"
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl font-semibold text-sm transition-all shadow-lg shadow-blue-900/40"
            >
              Get Started →
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <div className="max-w-5xl mx-auto px-6 pt-36 pb-20 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-900/50 border border-blue-700/60 rounded-full text-blue-300 text-sm mb-8 fade-in">
          <span className="w-2 h-2 rounded-full bg-blue-400 pulse-dot"></span>
          AI-Powered Proctoring — Live
        </div>

        <h1 className="text-5xl sm:text-6xl font-extrabold mb-6 leading-tight fade-in" style={{animationDelay:'0.1s'}}>
          Secure Exams with{' '}
          <span className="gradient-text">AI Monitoring</span>
        </h1>

        <p className="text-gray-300 text-lg sm:text-xl mb-10 max-w-2xl mx-auto leading-relaxed fade-in" style={{animationDelay:'0.2s'}}>
          Real-time face detection, eye tracking, noise analysis, and behavioral intelligence —
          all in one platform built for modern education.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center fade-in" style={{animationDelay:'0.3s'}}>
          <Link
            to="/login"
            className="px-8 py-3.5 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-base transition-all shadow-xl shadow-blue-900/40 hover:shadow-blue-900/60 hover:-translate-y-0.5"
          >
            🚀 Start Free →
          </Link>
          <a
            href="#features"
            className="px-8 py-3.5 bg-white/8 hover:bg-white/14 border border-white rounded-xl font-semibold text-white text-base transition-all hover:-translate-y-0.5"
          >
            Explore Features
          </a>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="max-w-4xl mx-auto px-6 pb-16">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {stats.map((s, i) => (
            <div key={i} className="glass-card rounded-2xl p-5 text-center">
              <div className="text-3xl font-extrabold gradient-text">{s.val}</div>
              <div className="text-gray-400 text-sm mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Features ── */}
      <div id="features" className="max-w-6xl mx-auto px-6 pb-24">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold mb-3">Everything you need</h2>
          <p className="text-gray-400 text-base max-w-xl mx-auto">
            Six AI proctors working in harmony to ensure exam integrity at any scale.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <div
              key={i}
              className="glass-card rounded-2xl p-6 hover:border-blue-700/40 hover:-translate-y-1 transition-all duration-300 group"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600/30 to-purple-600/20 flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
                {f.icon}
              </div>
              <h3 className="font-bold text-white mb-2">{f.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── CTA Banner ── */}
      <div className="max-w-4xl mx-auto px-6 pb-20">
        <div className="bg-gradient-to-r from-blue-900/60 to-purple-900/60 border border-blue-800/40 rounded-3xl p-10 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">Ready to get started?</h2>
          <p className="text-gray-300 mb-6 text-sm sm:text-base">Join educators using AI proctoring to ensure academic integrity.</p>
          <Link
            to="/login"
            className="inline-block px-8 py-3.5 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition-all shadow-xl hover:-translate-y-0.5"
          >
            Create Account →
          </Link>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="border-t border-gray-800 py-6 text-center text-gray-600 text-sm">
        <p>Built with React · Express.js · MongoDB · Socket.io · JWT · Redux</p>
        <p className="mt-1">© 2024 AI Exam Monitor</p>
      </div>
    </div>
  );
};

export default Landing;
