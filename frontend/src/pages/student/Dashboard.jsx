// frontend/src/pages/student/Dashboard.jsx
import { useEffect, useState, useRef } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, ArcElement, RadialLinearScale,
  Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import api from '../../services/api';
import DashboardLayout from '../../components/DashboardLayout';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, RadialLinearScale, Title, Tooltip, Legend, Filler
);

/* ── Shared chart defaults ─────────────────────────────────────── */
const chartBase = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { labels: { color: '#9ca3af', font: { size: 10, family: 'Poppins' } } } },
  scales: {
    x: { ticks: { color: '#6b7280', font: { size: 10 }, maxRotation: 30 }, grid: { color: 'rgba(255,255,255,0.04)' } },
    y: { ticks: { color: '#6b7280', font: { size: 10 } },                  grid: { color: 'rgba(255,255,255,0.04)' } },
  },
};

/* ── Mini bar chart for a single result ───────────────────────── */
const ResultMiniCharts = ({ sub }) => {
  if (sub.cheated) return null;
  const score   = sub.score ?? 0;
  const total   = sub.totalMarks || 1;
  const passing = (sub.exam?.passingScore || 40) * total / 100;

  const barData = {
    labels: ['Your Score', 'Pass Mark', 'Total'],
    datasets: [{
      label: 'Marks',
      data: [score, Math.round(passing), total],
      backgroundColor: ['rgba(59,130,246,0.7)', 'rgba(245,158,11,0.6)', 'rgba(75,85,99,0.4)'],
      borderColor:     ['#3b82f6', '#f59e0b', '#6b7280'],
      borderWidth: 1.5, borderRadius: 4,
    }],
  };

  const doughnutData = {
    labels: ['Scored', 'Remaining'],
    datasets: [{
      data: [score, Math.max(0, total - score)],
      backgroundColor: [sub.passed ? 'rgba(34,197,94,0.75)' : 'rgba(239,68,68,0.75)', 'rgba(30,41,59,0.6)'],
      borderColor:     [sub.passed ? '#22c55e' : '#ef4444', 'transparent'],
      borderWidth: 2,
    }],
  };

  return (
    <div className="grid grid-cols-2 gap-3 mt-3">
      <div>
        <p className="text-xs text-gray-500 mb-1.5 font-medium">📊 Score Breakdown</p>
        <div style={{ height: 110 }}>
          <Bar data={barData} options={{ ...chartBase, plugins: { legend: { display: false } } }} />
        </div>
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-1.5 font-medium">🎯 Score %</p>
        <div style={{ height: 110 }} className="flex items-center justify-center">
          <Doughnut data={doughnutData} options={{
            responsive: true, maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: { callbacks: { label: ctx => ` ${ctx.raw} marks` } },
            },
            cutout: '65%',
          }} />
        </div>
      </div>
    </div>
  );
};

/* ── Result Item (expandable, auto-collapse on outside click) ─── */
const ResultItem = ({ sub, isOpen, onToggle }) => {
  const ref = useRef(null);
  const title   = sub.exam?.title || 'Exam';
  const passed  = sub.passed;
  const cheated = sub.cheated;
  const date    = sub.submittedAt
    ? new Date(sub.submittedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';
  const startTime = sub.startedAt
    ? new Date(sub.startedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : '—';
  const endTime = sub.submittedAt
    ? new Date(sub.submittedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : '—';

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onToggle();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, onToggle]);

  return (
    <div ref={ref} className="rounded-xl overflow-hidden border border-slate-700/20 bg-white/[0.025]">
      <button
        onClick={onToggle}
        className="w-full flex justify-between items-center px-4 py-3 hover:bg-white/4 transition-colors text-left gap-3"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0
            ${cheated ? 'bg-red-900/50' : passed ? 'bg-green-900/50' : 'bg-orange-900/50'}`}>
            {cheated ? '🚫' : passed ? '✅' : '❌'}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-white text-sm truncate">{title}</p>
            <p className="text-xs text-gray-500">{date}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
            cheated ? 'bg-red-900/40 text-red-300 border border-red-800/40' :
            passed  ? 'bg-green-900/40 text-green-400 border border-green-800/40'
                    : 'bg-red-900/40 text-red-400 border border-red-800/40'}`}>
            {cheated ? 'Terminated' : passed ? 'Passed' : 'Failed'}
          </span>
          <span className="text-gray-500 text-xs">{isOpen ? '▲' : '▼'}</span>
        </div>
      </button>

      {isOpen && (
        <div className="px-4 pb-4 pt-2 border-t border-slate-700/15 fade-in">
          {cheated ? (
            <div className="bg-red-900/20 border border-red-800/30 rounded-xl p-3 text-center">
              <p className="text-red-300 font-semibold text-sm">Terminated due to violations</p>
              <p className="text-gray-400 text-xs mt-1">Score: 0 / {sub.totalMarks || '?'}</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { icon: '📅', label: 'Time', val: `${startTime} → ${endTime}` },
                  { icon: '📊', label: 'Score', val: `${sub.percentage ?? '—'}%`, sub: `${sub.score ?? '—'} / ${sub.totalMarks || '?'} marks`, bold: true, color: passed ? 'text-green-400' : 'text-red-400' },
                  { icon: '⏱', label: 'Time Taken', val: sub.timeTaken ? `${Math.floor(sub.timeTaken/60)}m ${sub.timeTaken%60}s` : '—' },
                  { icon: '📝', label: 'Submission', val: sub.autoSubmitted ? '⏰ Auto' : '✋ Manual', color: sub.autoSubmitted ? 'text-orange-400' : 'text-blue-400' },
                ].map((c, i) => (
                  <div key={i} className="bg-white/4 rounded-lg p-2.5">
                    <p className="text-xs text-gray-500 mb-0.5">{c.icon} {c.label}</p>
                    <p className={`text-sm font-semibold ${c.color || 'text-white'}`}>{c.val}</p>
                    {c.sub && <p className="text-xs text-gray-500">{c.sub}</p>}
                  </div>
                ))}
              </div>
              {/* Mini charts per result */}
              <ResultMiniCharts sub={sub} />
            </>
          )}
        </div>
      )}
    </div>
  );
};

/* ── All Results Panel (replaces drawer) ───────────────────────── */
const AllResultsPanel = ({ submissions, onBack }) => {
  const [openId, setOpenId] = useState(null);

  return (
    <div className="slide-in-up">
      {/* Panel header with back button */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-gray-400 hover:text-white bg-white/4 hover:bg-white/8 border border-slate-700/20 rounded-xl px-3 py-2 text-sm font-medium transition-all"
        >
          ← Back
        </button>
        <div>
          <h2 className="text-white font-bold">All Results</h2>
          <p className="text-gray-500 text-xs">{submissions.length} total exams</p>
        </div>
      </div>

      {/* Chart overview */}
      {submissions.length > 0 && (() => {
        const passed  = submissions.filter(s => s.passed && !s.cheated).length;
        const failed  = submissions.filter(s => !s.passed && !s.cheated).length;
        const cheated = submissions.filter(s => s.cheated).length;
        const sorted  = [...submissions].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')).slice(-10);

        const lineData = {
          labels: sorted.map((s, i) => s.exam?.title?.slice(0, 8) || `E${i + 1}`),
          datasets: [
            { label: 'Score %', data: sorted.map(s => s.cheated ? 0 : (s.percentage || 0)),
              borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', fill: true, tension: 0.4, pointRadius: 3, pointBackgroundColor: '#3b82f6' },
            { label: 'Pass %', data: sorted.map(s => s.exam?.passingScore || 40),
              borderColor: '#f59e0b', borderDash: [4, 4], pointRadius: 0, fill: false },
          ],
        };
        const donutData = {
          labels: ['Passed', 'Failed', 'Terminated'],
          datasets: [{ data: [passed, failed, cheated],
            backgroundColor: ['rgba(34,197,94,0.75)', 'rgba(239,68,68,0.75)', 'rgba(249,115,22,0.75)'],
            borderColor: ['#22c55e', '#ef4444', '#f97316'], borderWidth: 2 }],
        };

        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            <div className="lg:col-span-2 bg-gray-800/50 border border-slate-700/20 rounded-2xl p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">📈 Score History</p>
              <div style={{ height: 180 }}><Line data={lineData} options={chartBase} /></div>
            </div>
            <div className="bg-gray-800/50 border border-slate-700/20 rounded-2xl p-4 flex flex-col">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">🎯 Breakdown</p>
              <div style={{ height: 180 }} className="flex items-center justify-center">
                <Doughnut data={donutData} options={{
                  responsive: true, maintainAspectRatio: false,
                  plugins: { legend: { position: 'bottom', labels: { color: '#9ca3af', font: { size: 10 } } } },
                }} />
              </div>
            </div>
          </div>
        );
      })()}

      {/* Results list */}
      <div className="bg-gray-800/50 border border-slate-700/20 rounded-2xl p-4">
        <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
          {submissions.length === 0
            ? <p className="text-gray-400 text-sm text-center mt-4">No results yet.</p>
            : submissions.map(s => {
                const id = s.id || s._id;
                return (
                  <ResultItem
                    key={id}
                    sub={s}
                    isOpen={openId === id}
                    onToggle={() => setOpenId(openId === id ? null : id)}
                  />
                );
              })
          }
        </div>
      </div>
    </div>
  );
};

/* ── Main Dashboard ────────────────────────────────────────────── */
const StudentDashboard = () => {
  const { user }                      = useSelector(state => state.auth);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [showAllResults, setShowAllResults] = useState(false);
  const [openResultId, setOpenResultId] = useState(null);

  useEffect(() => {
    api.get('/student/submissions').then(({ data }) => {
      setSubmissions(data.submissions || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const avg     = submissions.length ? Math.round(submissions.reduce((s, x) => s + (x.cheated ? 0 : (x.percentage || 0)), 0) / submissions.length) : 0;
  const passed  = submissions.filter(s => s.passed && !s.cheated).length;
  const failed  = submissions.filter(s => !s.passed && !s.cheated).length;
  const cheated = submissions.filter(s => s.cheated).length;

  const sorted10 = [...submissions].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')).slice(-10);

  const lineData = {
    labels: sorted10.map((s, i) => s.exam?.title?.slice(0, 8) || `E${i + 1}`),
    datasets: [
      { label: 'Score %', data: sorted10.map(s => s.cheated ? 0 : (s.percentage || 0)),
        borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', fill: true, tension: 0.4, pointRadius: 3, pointBackgroundColor: '#3b82f6' },
      { label: 'Pass %', data: sorted10.map(s => s.exam?.passingScore || 40),
        borderColor: '#f59e0b', borderDash: [4, 4], pointRadius: 0, fill: false },
    ],
  };

  const doughnutData = {
    labels: ['Passed', 'Failed', 'Terminated'],
    datasets: [{
      data: [passed, failed, cheated],
      backgroundColor: ['rgba(34,197,94,0.75)', 'rgba(239,68,68,0.75)', 'rgba(249,115,22,0.75)'],
      borderColor: ['#22c55e', '#ef4444', '#f97316'], borderWidth: 2,
    }],
  };

  const statCards = [
    { label: 'Exams Taken', val: submissions.length, icon: '📝', color: 'text-blue-400',   bg: 'from-blue-900/30 to-blue-800/10',   border: 'border-blue-900/30' },
    { label: 'Avg Score',   val: `${avg}%`,          icon: '📊', color: 'text-green-400',  bg: 'from-green-900/30 to-green-800/10', border: 'border-green-900/30' },
    { label: 'Passed',      val: passed,              icon: '✅', color: 'text-yellow-400', bg: 'from-yellow-900/30 to-yellow-800/10',border: 'border-yellow-900/30' },
    { label: 'Failed',      val: failed + cheated,    icon: '❌', color: 'text-red-400',    bg: 'from-red-900/30 to-red-800/10',     border: 'border-red-900/30' },
  ];

  /* Profile pill replacing the small round button */
  const topBarActions = (
    <div className="flex items-center gap-2">
      {!showAllResults && (
        <button
          onClick={() => setShowAllResults(true)}
          className="text-xs px-3 py-1.5 bg-white/5 hover:bg-white/8 border border-slate-700/20 rounded-lg font-medium transition-colors text-gray-300 hidden sm:flex items-center gap-1.5"
        >
          📋 All Results
        </button>
      )}
    </div>
  );

  /* ── All Results Panel view ── */
  if (showAllResults) {
    return (
      <DashboardLayout title="All Results" actions={null}>
        <AllResultsPanel
          submissions={submissions}
          onBack={() => setShowAllResults(false)}
        />
      </DashboardLayout>
    );
  }

  /* ── Normal dashboard view ── */
  return (
    <DashboardLayout title="Student Dashboard" actions={topBarActions}>

      {/* ── Welcome Banner ── */}
      <div className="bg-gradient-to-r from-blue-900/40 to-purple-900/30 border border-blue-800/20 rounded-2xl p-5 mb-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">Welcome back, {user?.name?.split(' ')[0]}! 👋</h2>
          <p className="text-blue-200 text-sm mt-0.5">
            {user?.rollNumber && <span className="mr-3">🎓 {user.rollNumber}</span>}
            {user?.department  && <span>🏛️ {user.department}</span>}
          </p>
        </div>
        <Link
          to="/student/assessments"
          className="shrink-0 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl font-semibold text-sm transition-all shadow-lg shadow-blue-900/30"
        >
          📝 Browse Exams →
        </Link>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {statCards.map((s, i) => (
          <div key={i} className={`bg-gradient-to-br ${s.bg} rounded-xl p-4 text-center border ${s.border}`}>
            <div className="text-xl mb-1">{s.icon}</div>
            <div className={`text-2xl font-bold ${s.color}`}>{s.val}</div>
            <div className="text-gray-400 tex-xs mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Charts Row ── */}
      {submissions.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
          <div className="lg:col-span-2 bg-gray-800/50 border border-slate-700/20 rounded-2xl p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">📈 Performance History</p>
            <div style={{ height: 200 }}>
              <Line data={lineData} options={chartBase} />
            </div>
          </div>
          <div className="bg-gray-800/50 border border-slate-700/20 rounded-2xl p-4 flex flex-col">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">🎯 Result Breakdown</p>
            <div style={{ height: 200 }} className="flex items-center justify-center">
              <Doughnut data={doughnutData} options={{
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { color: '#9ca3af', font: { size: 10 } } } },
              }} />
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile Results Button ── */}
      <div className="sm:hidden mb-4">
        <button
          onClick={() => setShowAllResults(true)}
          className="w-full py-3 bg-gray-800/50 border border-slate-700/20 rounded-xl text-sm font-semibold text-gray-300 hover:bg-gray-800 transition-colors"
        >
          📋 View All Results ({submissions.length})
        </button>
      </div>

      {/* ── Recent Results (inline) ── */}
      <div className="bg-gray-800/50 border border-slate-700/20 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white text-sm">📋 Recent Results</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">{submissions.length} total</span>
            {submissions.length > 5 && (
              <button onClick={() => setShowAllResults(true)} className="text-xs text-blue-400 hover:underline">
                View all →
              </button>
            )}
          </div>
        </div>
        {loading ? (
          <div className="text-center py-6 text-gray-400 text-sm">
            <div className="text-2xl mb-2 animate-pulse">⏳</div>Loading...
          </div>
        ) : submissions.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-4xl mb-2">📭</p>
            <p className="text-gray-400 text-sm">No exams taken yet.</p>
            <Link to="/student/assessments" className="text-blue-400 text-sm hover:underline mt-1 inline-block">Browse available exams →</Link>
          </div>
        ) : (
          <div className="space-y-2">
            {submissions.slice(0, 5).map(s => {
              const id = s.id || s._id;
              return (
                <ResultItem
                  key={id}
                  sub={s}
                  isOpen={openResultId === id}
                  onToggle={() => setOpenResultId(openResultId === id ? null : id)}
                />
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default StudentDashboard;
