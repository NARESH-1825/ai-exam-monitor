// frontend/src/pages/faculty/LiveMonitor.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useSocket } from '../../hooks/useSocket';
import DashboardLayout from '../../components/DashboardLayout';
import api from '../../services/api';
import { toast } from 'react-toastify';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  ArcElement, Title, Tooltip, Legend
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

const VIOLATION_LABELS = {
  MULTIPLE_FACES: 'Multiple Faces', FACE_NOT_FOUND: 'Face Not Found',
  TAB_SWITCH: 'Tab Switch',         NOISE_DETECTED: 'Noise Detected',
  OBJECT_DETECTED: 'Obj. Detected', COPY_ATTEMPT: 'Copy Attempt',
  GAZE_AWAY: 'Gaze Away',           FULLSCREEN_EXIT: 'Fullscreen Exit',
  DEVTOOLS_ATTEMPT: 'DevTools',
};

const vcColor  = n => n >= 3 ? 'text-red-400' : n >= 2 ? 'text-orange-400' : n >= 1 ? 'text-yellow-400' : 'text-green-400';
const vcBgBrd  = n => n >= 3 ? 'bg-red-900/30 border-red-700' : n >= 2 ? 'bg-orange-900/20 border-orange-700' : 'bg-white/4 border-slate-700/20';

const statusBadge = (status, cheated, reason) => {
  if (cheated)                            return { label: '🚫 Cheated',   cls: 'bg-red-900/50 text-red-300 border border-red-800/40' };
  if (status === 'submitted' && reason?.includes('Faculty')) return { label: 'Blocked',    cls: 'bg-orange-900/50 text-orange-200 border border-orange-800/40' };
  if (status === 'submitted' && reason?.includes('Time'))   return { label: 'Time Up',    cls: 'bg-yellow-900/50 text-yellow-200 border border-yellow-800/40' };
  if (status === 'submitted')             return { label: 'Submitted',   cls: 'bg-blue-900/50 text-blue-300 border border-blue-800/40' };
  return                                         { label: '● Attending', cls: 'bg-green-900/50 text-green-400 border border-green-800/40 live-badge' };
};

/* ── Student Card (auto-collapse on outside click) ───────────────── */
const StudentCard = React.memo(({ s }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const badge = statusBadge(s.status, s.cheated, s.autoSubmitReason);
  const vc    = s.violationCount || 0;
  const violationSummary = (s.events || []).reduce((acc, e) => { acc[e.type] = (acc[e.type] || 0) + 1; return acc; }, {});

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className={`bg-gray-800/60 rounded-2xl border-2 transition-all ${
      s.cheated ? 'border-red-600/50' : vc >= 2 ? 'border-orange-600/40' : s.status === 'submitted' ? 'border-blue-700/40' : 'border-slate-700/25'}`}>
      <div className="flex items-start gap-2 p-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm font-bold shrink-0">
          {s.student?.name?.[0]?.toUpperCase() || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white text-sm truncate">{s.student?.name || 'Student'}</p>
          {s.student?.rollNumber && <p className="text-xs text-gray-400">{s.student.rollNumber}</p>}
        </div>
        <button onClick={() => setOpen(o => !o)} className="text-gray-400 hover:text-white text-xs px-1">
          {open ? '▲' : '▼'}
        </button>
      </div>

      <div className="px-3 pb-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${badge.cls}`}>{badge.label}</span>
          <div className={`rounded-lg px-2.5 py-1 border text-center ${vcBgBrd(vc)}`}>
            <span className="text-xs text-gray-400">⚠ </span>
            <span className={`font-bold text-sm ${vcColor(vc)}`}>{vc}</span>
            <span className="text-xs text-gray-500">/3</span>
          </div>
        </div>

        {s.status === 'submitted' && s.percentage !== undefined && (
          <div className="bg-white/4 rounded-lg py-1.5 text-center">
            <span className={`font-bold text-sm ${s.cheated ? 'text-red-400' : s.passed ? 'text-green-400' : 'text-orange-400'}`}>
              {s.cheated ? '0%' : `${s.percentage}%`}
            </span>
            {!s.cheated && s.score !== undefined && (
              <span className="text-gray-400 text-xs ml-1">({s.score}/{s.totalMarks})</span>
            )}
          </div>
        )}

        {open && Object.keys(violationSummary).length > 0 && (
          <div className="border-t border-slate-700/20 pt-2 space-y-1 fade-in">
            {Object.entries(violationSummary).map(([type, cnt]) => (
              <div key={type} className="flex justify-between text-xs">
                <span className="text-gray-400">{VIOLATION_LABELS[type] || type}</span>
                <span className="text-red-400 font-bold">×{cnt}</span>
              </div>
            ))}
          </div>
        )}
        {open && Object.keys(violationSummary).length === 0 && (
          <p className="text-xs text-green-400 border-t border-slate-700/20 pt-2">✅ No violations</p>
        )}
      </div>
    </div>
  );
});

/* ── Leaderboard with Charts ─────────────────────────────────────── */
const Leaderboard = ({ examId }) => {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [open,    setOpen]    = useState({});

  useEffect(() => {
    api.get(`/faculty/exam-results/${examId}`)
      .then(({ data }) => { setData(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [examId]);

  if (loading) return <div className="text-center py-10 text-gray-400 animate-pulse">Loading results…</div>;
  if (!data)   return <div className="text-center py-10 text-red-400">Failed to load results</div>;

  const { submissions = [], totalMarks = 0 } = data;
  const filtered = submissions.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (s.studentInfo?.name || '').toLowerCase().includes(q) || (s.studentInfo?.rollNumber || '').toLowerCase().includes(q);
  });

  const passedCount  = submissions.filter(s => s.passed && !s.cheated).length;
  const failedCount  = submissions.filter(s => !s.passed && !s.cheated).length;
  const cheatedCount = submissions.filter(s => s.cheated).length;
  const medal = r => r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : `#${r}`;

  /* Score distribution buckets */
  const buckets = ['0-20', '21-40', '41-60', '61-80', '81-100'];
  const bucketCounts = buckets.map((_, i) => {
    const lo = i * 20, hi = (i + 1) * 20;
    return submissions.filter(s => !s.cheated && (s.percentage || 0) > lo && (s.percentage || 0) <= hi).length;
  });

  const barData = {
    labels: buckets,
    datasets: [{
      label: 'Students',
      data: bucketCounts,
      backgroundColor: ['rgba(239,68,68,0.65)', 'rgba(249,115,22,0.65)', 'rgba(245,158,11,0.65)', 'rgba(34,197,94,0.65)', 'rgba(59,130,246,0.65)'],
      borderColor:     ['#ef4444', '#f97316', '#f59e0b', '#22c55e', '#3b82f6'],
      borderWidth: 1.5, borderRadius: 4,
    }],
  };

  const donutData = {
    labels: ['Passed', 'Failed', 'Terminated'],
    datasets: [{
      data: [passedCount, failedCount, cheatedCount],
      backgroundColor: ['rgba(34,197,94,0.75)', 'rgba(239,68,68,0.75)', 'rgba(249,115,22,0.75)'],
      borderColor: ['#22c55e', '#ef4444', '#f97316'], borderWidth: 2,
    }],
  };

  const chartOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: '#6b7280', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
      y: { ticks: { color: '#6b7280', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
    },
  };

  return (
    <div className="space-y-4">
      {/* Summary stat cards */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total',   val: submissions.length,  color: 'text-blue-400'   },
          { label: 'Passed',  val: passedCount,          color: 'text-green-400'  },
          { label: 'Failed',  val: failedCount,          color: 'text-red-400'    },
          { label: 'Cheated', val: cheatedCount,         color: 'text-orange-400' },
        ].map((c, i) => (
          <div key={i} className="bg-white/4 border border-slate-700/20 rounded-xl p-3 text-center">
            <div className={`text-2xl font-bold ${c.color}`}>{c.val}</div>
            <div className="text-gray-400 text-xs mt-0.5">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      {submissions.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-gray-800/50 border border-slate-700/20 rounded-2xl p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">📊 Score Distribution</p>
            <div style={{ height: 180 }}>
              <Bar data={barData} options={chartOpts} />
            </div>
          </div>
          <div className="bg-gray-800/50 border border-slate-700/20 rounded-2xl p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">🎯 Pass / Fail</p>
            <div style={{ height: 180 }} className="flex items-center justify-center">
              <Doughnut data={donutData} options={{
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { color: '#9ca3af', font: { size: 10 } } } },
              }} />
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <input placeholder="Search by name or roll…" value={search} onChange={e => setSearch(e.target.value)}
        className="w-full bg-gray-800/60 text-white px-4 py-2.5 rounded-xl outline-none border border-slate-700/20 focus:border-blue-500 text-sm" />

      {/* Leaderboard list */}
      <div className="space-y-2">
        {filtered.map(s => {
          const isOpen   = open[s.id];
          const vc       = s.violationCount || 0;
          const vSummary = (s.violationEvents || []).reduce((acc, e) => { acc[e.type] = (acc[e.type] || 0) + 1; return acc; }, {});
          return (
            <div key={s.id} className={`bg-gray-800/50 rounded-xl border overflow-hidden ${s.cheated ? 'border-red-800/40' : s.rank <= 3 ? 'border-yellow-800/40' : 'border-slate-700/20'}`}>
              <button onClick={() => setOpen(p => ({ ...p, [s.id]: !p[s.id] }))}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/4 transition-colors text-left">
                <span className="text-xl w-8 shrink-0 text-center">{s.cheated ? '🚫' : medal(s.rank)}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white text-sm">{s.studentInfo?.name || 'Unknown'}</p>
                  <p className="text-xs text-gray-400">{s.studentInfo?.rollNumber || ''}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`font-bold text-sm ${s.cheated ? 'text-red-400' : s.passed ? 'text-green-400' : 'text-red-400'}`}>
                    {s.cheated ? `0/${totalMarks}` : `${s.score ?? '—'}/${totalMarks}`}
                  </p>
                  <p className="text-xs text-gray-400">{s.cheated ? '0%' : `${s.percentage ?? '—'}%`}</p>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${vcBgBrd(vc)} ${vcColor(vc)}`}>{vc}/3</span>
                <span className="text-gray-500 text-xs">{isOpen ? '▲' : '▼'}</span>
              </button>
              {isOpen && (
                <div className="border-t border-slate-700/15 px-4 py-3 space-y-2 fade-in">
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Score', val: s.cheated ? `0/${totalMarks} (Cheated)` : `${s.score ?? '—'}/${totalMarks} (${s.percentage ?? '—'}%)`, color: s.cheated ? 'text-red-400' : '' },
                      { label: 'Submission', val: s.autoSubmitted ? 'Auto' : 'Manual', color: s.autoSubmitted ? 'text-orange-400' : 'text-blue-400' },
                      { label: 'Violations', val: `${vc}/3`, color: vcColor(vc) },
                      { label: 'Time', val: s.timeTaken ? `${Math.floor(s.timeTaken/60)}m ${s.timeTaken%60}s` : '—' },
                    ].map((c, i) => (
                      <div key={i} className="bg-white/4 rounded-lg p-2">
                        <p className="text-xs text-gray-400 mb-0.5">{c.label}</p>
                        <p className={`text-xs font-medium ${c.color || 'text-white'}`}>{c.val}</p>
                      </div>
                    ))}
                  </div>
                  {Object.keys(vSummary).length > 0 && (
                    <div className="bg-red-900/15 border border-red-800/25 rounded-lg p-2.5">
                      <p className="text-xs text-red-400 font-semibold mb-1">Violations:</p>
                      {Object.entries(vSummary).map(([type, cnt]) => (
                        <div key={type} className="flex justify-between text-xs">
                          <span className="text-gray-300">{VIOLATION_LABELS[type] || type}</span>
                          <span className="text-red-400 font-bold">×{cnt}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ── Page Close Timer ────────────────────────────────────────────── */
const PageCloseTimer = ({ startTime, pageCloseTime, onExpire }) => {
  const [secs, setSecs] = useState(null);
  const fired = useRef(false);
  useEffect(() => {
    if (!pageCloseTime || !startTime) return;
    const closeMs = new Date(startTime).getTime() + pageCloseTime * 60 * 1000;
    const calc = () => Math.max(0, Math.floor((closeMs - Date.now()) / 1000));
    const init = calc(); setSecs(init);
    if (init <= 0) { if (!fired.current) { fired.current = true; onExpire?.(); } return; }
    const t = setInterval(() => {
      const r = calc(); setSecs(r);
      if (r <= 0) { clearInterval(t); if (!fired.current) { fired.current = true; onExpire?.(); } }
    }, 1000);
    return () => clearInterval(t);
  }, [startTime, pageCloseTime]);
  if (secs === null) return null;
  const m = Math.floor(secs / 60), s = secs % 60;
  return (
    <span className={`text-xs font-mono font-bold px-3 py-1.5 rounded-lg ${
      secs === 0 ? 'text-gray-500 bg-gray-700' :
      secs < 300 ? 'text-red-300 bg-red-900/40 border border-red-700/50' :
                   'text-purple-300 bg-purple-900/40 border border-purple-700/50'}`}>
      {secs === 0 ? 'Page Closed' : `Closes ${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`}
    </span>
  );
};

/* ── Main LiveMonitor ─────────────────────────────────────────────── */
const LiveMonitor = () => {
  const { examId } = useParams();
  const { token }  = useSelector(s => s.auth);
  const socket     = useSocket(token);
  const [exam,     setExam]     = useState(null);
  const [students, setStudents] = useState({});
  const [activeTab, setActiveTab] = useState('live');
  const endingRef  = useRef(false);

  const loadSubmissions = useCallback(() => {
    api.get(`/monitor/${examId}/submissions`).then(({ data }) => {
      const map = {};
      (data.submissions || []).forEach(sub => {
        const si  = sub.studentInfo || (typeof sub.student === 'object' ? sub.student : null);
        const sid = si?.id || (typeof sub.student === 'string' ? sub.student : null);
        if (!sid) return;
        map[sid] = {
          id: sub.id, student: si,
          status: sub.status || 'ongoing',
          violationCount: sub.violationCount || 0,
          cheated: sub.cheated || false,
          score: sub.score, totalMarks: sub.totalMarks,
          percentage: sub.percentage, passed: sub.passed,
          autoSubmitted: sub.autoSubmitted, autoSubmitReason: sub.autoSubmitReason,
          events: sub.cheatEvents || sub.violationEvents || [],
        };
      });
      setStudents(prev => {
        const merged = { ...map };
        Object.keys(prev).forEach(sid => {
          if (merged[sid]) {
            if ((prev[sid].events?.length || 0) > (merged[sid].events?.length || 0)) merged[sid].events = prev[sid].events;
            if ((prev[sid].violationCount || 0) > (merged[sid].violationCount || 0)) merged[sid].violationCount = prev[sid].violationCount;
          }
        });
        return merged;
      });
    }).catch(() => {});
  }, [examId]);

  const doEndExam = useCallback(async () => {
    if (endingRef.current) return;
    endingRef.current = true;
    try {
      await api.put(`/exam/${examId}/end`);
      setExam(e => e ? { ...e, status: 'completed' } : e);
      toast.info('Exam ended.');
    } catch { endingRef.current = false; }
  }, [examId]);

  useEffect(() => {
    api.get(`/exam/${examId}`).then(({ data }) => { setExam(data.exam); if (data.exam?.status === 'completed') setActiveTab('results'); });
    loadSubmissions();
  }, [examId, loadSubmissions]);

  useEffect(() => {
    if (!socket) return;
    socket.emit('join:monitor', { examId });
    socket.on('student:joined', () => setTimeout(loadSubmissions, 500));
    socket.on('proctor:update', ({ studentId, event, violationCount }) => {
      setStudents(prev => {
        const ex = prev[studentId] || {};
        return { ...prev, [studentId]: { ...ex, violationCount: Math.max(violationCount || 0, ex.violationCount || 0), events: [...(ex.events || []), event].slice(-50) } };
      });
    });
    socket.on('student:submitted', ({ studentId, score, totalMarks, percentage, passed, autoSubmitted, autoSubmitReason, cheated, violationCount }) => {
      setStudents(prev => ({ ...prev, [studentId]: {
        ...prev[studentId], status: 'submitted',
        score, totalMarks, percentage, passed, autoSubmitted, autoSubmitReason,
        cheated: cheated || false,
        violationCount: violationCount !== undefined ? Math.max(violationCount, prev[studentId]?.violationCount || 0) : prev[studentId]?.violationCount,
      }}));
    });
    return () => { socket.off('student:joined'); socket.off('proctor:update'); socket.off('student:submitted'); };
  }, [socket, examId, loadSubmissions]);

  const entries     = Object.entries(students);
  const liveEntries = entries.filter(([, s]) => s.status === 'ongoing');
  const doneCount   = entries.filter(([, s]) => s.status === 'submitted').length;
  const cheatCount  = entries.filter(([, s]) => s.cheated).length;
  const isCompleted = exam?.status === 'completed';

  const topActions = (
    <div className="flex items-center gap-2 flex-wrap">
      {exam?.status === 'live' && exam.pageCloseTime > 0 && (
        <PageCloseTimer startTime={exam.startTime} pageCloseTime={exam.pageCloseTime} onExpire={doEndExam} />
      )}
      {/* Live badge with blinking animation */}
      <span className="text-xs bg-green-900/25 text-green-400 border border-green-800/40 px-2.5 py-1 rounded-lg live-badge flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400 pulse-dot live-ring inline-block"></span>
        {liveEntries.length} Live
      </span>
      <span className="text-xs bg-blue-900/25 text-blue-400 border border-blue-800/40 px-2.5 py-1 rounded-lg">✓ {doneCount} Done</span>
      {cheatCount > 0 && <span className="text-xs bg-red-900/30 text-red-400 border border-red-800/40 px-2.5 py-1 rounded-lg">🚫 {cheatCount}</span>}
      {exam?.status === 'live' && (
        <button onClick={async () => { if (!confirm('End exam?')) return; await doEndExam(); }}
          className="px-3 py-1 bg-red-700 hover:bg-red-600 rounded-lg text-xs font-bold transition-colors">
          ⏹ End
        </button>
      )}
    </div>
  );

  const pageTitle = `${isCompleted ? 'Results' : 'Live Monitor'} — ${exam?.title || '…'}`;

  return (
    <DashboardLayout title={pageTitle} actions={topActions}>
      {/* Tab bar */}
      {isCompleted && (
        <div className="flex bg-gray-800/50 border border-slate-700/20 rounded-xl p-1 mb-5 gap-1 w-fit">
          {[['live', '📊 Live Feed'], ['results', '🏆 Leaderboard']].map(([key, label]) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${activeTab === key ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
              {label}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'results' && isCompleted ? (
        <Leaderboard examId={examId} />
      ) : liveEntries.length === 0 && doneCount === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-800/50 border border-slate-700/20 flex items-center justify-center text-3xl mb-4">👥</div>
          <h3 className="text-white font-semibold mb-1">No students yet</h3>
          <p className="text-sm text-gray-500">Students appear here as they join the exam</p>
        </div>
      ) : liveEntries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-3xl mb-3">✅</p>
          <h3 className="text-white font-semibold mb-1">All students submitted</h3>
          <p className="text-gray-400 text-sm">{doneCount} student{doneCount !== 1 ? 's' : ''} completed. End the exam to view results.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {liveEntries.map(([id, s]) => <StudentCard key={id} s={s} />)}
        </div>
      )}
    </DashboardLayout>
  );
};

export default LiveMonitor;
