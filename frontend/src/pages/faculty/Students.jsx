// frontend/src/pages/faculty/Students.jsx
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  ArcElement, Title, Tooltip, Legend
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import DashboardLayout from '../../components/DashboardLayout';
import api from '../../services/api';
import { toast } from 'react-toastify';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

const VIOLATION_LABELS = {
  MULTIPLE_FACES:   '👥 Multiple Faces',  FACE_NOT_FOUND:   '👤 Face Not Found',
  TAB_SWITCH:       '🔄 Tab Switch',       NOISE_DETECTED:   '🎤 Noise Detected',
  OBJECT_DETECTED:  '📱 Object Detected',  COPY_ATTEMPT:     '📋 Copy Attempt',
  GAZE_AWAY:        '👁 Gaze Away',        FULLSCREEN_EXIT:  '⛶ Fullscreen Exit',
  DEVTOOLS_ATTEMPT: '🛠 DevTools',
};

const vcColor = n => n >= 3 ? 'text-red-400' : n >= 2 ? 'text-orange-400' : n >= 1 ? 'text-yellow-400' : 'text-green-400';

/* ── Submission Item (auto-collapse on outside click) ─────────── */
const SubmissionItem = ({ sub, isOpen, onToggle }) => {
  const ref = useRef(null);
  const title      = sub.exam?.title || 'Exam';
  const passed     = sub.passed;
  const cheated    = sub.cheated || false;
  const totalMarks = sub.exam?.totalMarks ?? sub.totalMarks ?? '?';
  const score      = sub.score ?? '—';
  const violationEvents = sub.violationEvents || [];
  const violationCount  = sub.violationCount ?? violationEvents.length;
  const violationSummary = violationEvents.reduce((acc, e) => { acc[e.type] = (acc[e.type] || 0) + 1; return acc; }, {});
  const date = sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—';
  const badge = cheated
    ? { text: '🚫 Terminated', cls: 'bg-red-900/40 text-red-300 border border-red-800/40' }
    : passed
      ? { text: '✅ Pass',      cls: 'bg-green-900/40 text-green-300 border border-green-800/40' }
      : { text: '❌ Fail',      cls: 'bg-red-900/40 text-red-300 border border-red-800/40' };

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onToggle(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, onToggle]);

  return (
    <div ref={ref} className={`rounded-xl overflow-hidden border ${cheated ? 'border-red-800/40 bg-red-950/10' : 'border-slate-700/20 bg-white/[0.025]'}`}>
      <button onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/4 transition-colors text-left gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="min-w-0">
            <p className="font-medium text-white text-xs truncate">{title}</p>
            <p className="text-gray-500 text-xs">{date}{violationCount > 0 && <span className={`ml-2 ${vcColor(violationCount)}`}>⚠️ {violationCount}/3</span>}</p>
          </div>
        </div>
        <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.text}</span>
      </button>

      {isOpen && (
        <div className="border-t border-slate-700/15 px-3 py-3 space-y-2 fade-in">
          {cheated && (
            <div className="bg-red-900/20 border border-red-800/30 rounded-lg p-2.5 text-center">
              <p className="text-red-300 text-xs font-semibold">Auto-terminated · 0 / {totalMarks} marks</p>
            </div>
          )}
          {!cheated && (
            <div className="grid grid-cols-2 gap-1.5">
              <div className="bg-white/4 rounded-lg p-2"><p className="text-gray-500 text-xs">Score</p>
                <p className={`text-sm font-bold ${passed ? 'text-green-400' : 'text-red-400'}`}>{score}/{totalMarks} · {sub.percentage ?? '—'}%</p></div>
              <div className="bg-white/4 rounded-lg p-2"><p className="text-gray-500 text-xs">Submit</p>
                <p className={`text-xs font-medium ${sub.autoSubmitted ? 'text-orange-400' : 'text-blue-400'}`}>{sub.autoSubmitted ? '⏰ Auto' : '✋ Manual'}</p></div>
            </div>
          )}
          {Object.keys(violationSummary).length > 0 && (
            <div className="bg-red-900/15 border border-red-800/25 rounded-lg p-2.5">
              <p className="text-red-400 text-xs font-semibold mb-1">Violations:</p>
              {Object.entries(violationSummary).map(([type, count]) => (
                <div key={type} className="flex justify-between text-xs">
                  <span className="text-gray-400">{VIOLATION_LABELS[type] || type}</span>
                  <span className="text-red-400 font-bold">×{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ── Student Detail Panel (inline, replaces drawer) ────────────── */
const StudentDetailPanel = ({ student, detail, detailLoading, onBack, onBlock, blockingId }) => {
  const [openSubId, setOpenSubId] = useState(null);
  const sid    = student?.id || student?._id;
  const sDetail = detail?.student;
  const subs    = detail?.submissions || [];
  const cheated = subs.filter(s => s.cheated).length;
  const passed  = subs.filter(s => s.passed && !s.cheated).length;
  const failed  = subs.filter(s => !s.passed && !s.cheated).length;
  const avg     = subs.length ? Math.round(subs.reduce((a, s) => a + (s.cheated ? 0 : (s.percentage || 0)), 0) / subs.length) : null;

  // Chart: score history bar
  const sortedSubs = [...subs].sort((a, b) => (a.submittedAt || '').localeCompare(b.submittedAt || '')).slice(-8);

  const barData = {
    labels: sortedSubs.map((s, i) => s.exam?.title?.slice(0, 7) || `E${i + 1}`),
    datasets: [{
      label: 'Score %',
      data: sortedSubs.map(s => s.cheated ? 0 : (s.percentage || 0)),
      backgroundColor: sortedSubs.map(s => s.cheated ? 'rgba(239,68,68,0.6)' : s.passed ? 'rgba(34,197,94,0.65)' : 'rgba(249,115,22,0.6)'),
      borderColor:     sortedSubs.map(s => s.cheated ? '#ef4444' : s.passed ? '#22c55e' : '#f97316'),
      borderWidth: 1.5, borderRadius: 4,
    }],
  };

  const doughnutData = {
    labels: ['Passed', 'Failed', 'Terminated'],
    datasets: [{
      data: [passed, failed, cheated],
      backgroundColor: ['rgba(34,197,94,0.75)', 'rgba(239,68,68,0.75)', 'rgba(249,115,22,0.75)'],
      borderColor: ['#22c55e', '#ef4444', '#f97316'], borderWidth: 2,
    }],
  };

  const chartOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: '#6b7280', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
      y: { ticks: { color: '#6b7280', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.04)' }, min: 0, max: 100 },
    },
  };

  return (
    <div className="slide-in-up">
      {/* Back button header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-gray-400 hover:text-white bg-white/4 hover:bg-white/8 border border-slate-700/20 rounded-xl px-3 py-2 text-sm font-medium transition-all"
        >
          ← Back to Students
        </button>
        <div>
          <h2 className="text-white font-bold">{sDetail?.name || student?.name}</h2>
          <p className="text-gray-500 text-xs">{sDetail?.email || student?.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Profile & stats */}
        <div className="space-y-4">
          {/* Profile card */}
          <div className="bg-gray-800/50 border border-slate-700/20 rounded-2xl p-5">
            {detailLoading ? (
              <div className="flex items-center justify-center py-8 text-gray-400">
                <div className="text-center"><div className="text-3xl mb-2 animate-pulse">⏳</div><p className="text-sm">Loading...</p></div>
              </div>
            ) : (
              <>
                <div className="text-center mb-4">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-3 ${sDetail?.isBlocked ? 'bg-red-800' : 'bg-gradient-to-br from-blue-500 to-purple-600'}`}>
                    {sDetail?.isBlocked ? '🚫' : (sDetail?.name?.[0]?.toUpperCase() || '?')}
                  </div>
                  <h4 className="font-bold text-white">{sDetail?.name}</h4>
                  <p className="text-gray-400 text-xs mt-0.5">{sDetail?.email}</p>
                  <div className="flex justify-center gap-3 mt-1.5 text-xs text-gray-500 flex-wrap">
                    {sDetail?.rollNumber && <span>🎓 {sDetail.rollNumber}</span>}
                    {sDetail?.department  && <span>🏛️ {sDetail.department}</span>}
                  </div>
                  {sDetail?.isBlocked && (
                    <div className="mt-3 bg-red-900/20 border border-red-800/30 rounded-xl p-2.5 text-xs text-red-300">
                      ⚠️ This student is blocked
                    </div>
                  )}
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {[
                    { label: 'Exams',  val: subs.length,  color: 'text-blue-400'   },
                    { label: 'Passed', val: passed,        color: 'text-green-400'  },
                    { label: 'Avg',    val: avg !== null ? `${avg}%` : '—', color: 'text-yellow-400' },
                    { label: 'Term.',  val: cheated,       color: cheated > 0 ? 'text-red-400' : 'text-gray-500' },
                  ].map((c, i) => (
                    <div key={i} className="bg-white/4 rounded-xl p-2 text-center border border-slate-700/15">
                      <div className={`text-lg font-bold ${c.color}`}>{c.val}</div>
                      <div className="text-gray-500 text-xs">{c.label}</div>
                    </div>
                  ))}
                </div>

                {/* Block button */}
                <button
                  onClick={() => onBlock(sid, sDetail?.name, sDetail?.isBlocked)}
                  disabled={blockingId === sid}
                  className={`w-full py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-50
                    ${sDetail?.isBlocked ? 'bg-green-700 hover:bg-green-600' : 'bg-red-700 hover:bg-red-600'}`}>
                  {blockingId === sid ? '⏳ Processing...' : sDetail?.isBlocked ? '✅ Unblock Student' : '🚫 Block Student'}
                </button>
              </>
            )}
          </div>

          {/* Result summary doughnut */}
          {!detailLoading && subs.length > 0 && (
            <div className="bg-gray-800/50 border border-slate-700/20 rounded-2xl p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">🎯 Result Breakdown</p>
              <div style={{ height: 160 }} className="flex items-center justify-center">
                <Doughnut data={doughnutData} options={{
                  responsive: true, maintainAspectRatio: false,
                  plugins: { legend: { position: 'bottom', labels: { color: '#9ca3af', font: { size: 10 } } } },
                }} />
              </div>
            </div>
          )}
        </div>

        {/* Right: Charts + exam history */}
        <div className="lg:col-span-2 space-y-4">
          {/* Score history bar chart */}
          {!detailLoading && subs.length > 0 && (
            <div className="bg-gray-800/50 border border-slate-700/20 rounded-2xl p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">📈 Score History</p>
              <div style={{ height: 180 }}>
                <Bar data={barData} options={chartOpts} />
              </div>
            </div>
          )}

          {/* Exam history list */}
          <div className="bg-gray-800/50 border border-slate-700/20 rounded-2xl p-4">
            <h5 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Exam History ({subs.length})
            </h5>
            {detailLoading ? (
              <div className="text-center py-6 text-gray-400"><div className="animate-pulse text-2xl mb-2">⏳</div></div>
            ) : subs.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">No exams taken</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {subs.map((sub, i) => {
                  const id = sub.id || i;
                  return (
                    <SubmissionItem
                      key={id}
                      sub={sub}
                      isOpen={openSubId === id}
                      onToggle={() => setOpenSubId(openSubId === id ? null : id)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Main Students Page ─────────────────────────────────────────── */
const Students = () => {
  const [students,       setStudents]      = useState([]);
  const [loading,        setLoading]       = useState(true);
  const [search,         setSearch]        = useState('');
  const [selected,       setSelected]      = useState(null);
  const [detail,         setDetail]        = useState(null);
  const [detailLoading,  setDetailLoading] = useState(false);
  const [blockingId,     setBlockingId]    = useState(null);

  useEffect(() => {
    api.get('/faculty/students').then(({ data }) => {
      setStudents(data.students || []);
      setLoading(false);
    }).catch(() => { toast.error('Failed to load students'); setLoading(false); });
  }, []);

  const loadDetail = async (sid) => {
    setDetailLoading(true);
    try {
      const { data } = await api.get(`/faculty/students/${sid}`);
      setDetail(data);
    } catch { toast.error('Failed to load student detail'); }
    setDetailLoading(false);
  };

  const handleSelect = (student) => {
    setSelected(student);
    setDetail(null);
    loadDetail(student.id || student._id || student.uid);
  };

  const handleBack = () => { setSelected(null); setDetail(null); };

  const handleBlock = useCallback(async (studentId, name, isBlocked) => {
    const action = isBlocked ? 'unblock' : 'block';
    if (!confirm(`${action === 'block' ? 'Block' : 'Unblock'} ${name}?`)) return;
    setBlockingId(studentId);
    try {
      await api.post(`/faculty/students/${studentId}/${action}`);
      setStudents(prev => prev.map(s => (s.id || s._id) === studentId ? { ...s, isBlocked: !isBlocked } : s));
      if (selected && (selected.id || selected._id) === studentId) setSelected(s => ({ ...s, isBlocked: !isBlocked }));
      if (detail?.student) setDetail(d => ({ ...d, student: { ...d.student, isBlocked: !isBlocked } }));
      toast.success(`${name} ${action === 'block' ? 'blocked' : 'unblocked'}`);
    } catch (err) { toast.error(err.response?.data?.message || `Failed to ${action}`); }
    setBlockingId(null);
  }, [selected, detail]);

  const filtered = students.filter(s =>
    !search ||
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.email?.toLowerCase().includes(search.toLowerCase()) ||
    s.rollNumber?.toLowerCase().includes(search.toLowerCase())
  );

  const searchBar = (
    <div className="relative">
      <input placeholder="🔍 Search students..." value={search} onChange={e => setSearch(e.target.value)}
        className="bg-gray-800/60 text-white px-4 py-1.5 rounded-xl outline-none border border-slate-700/20 focus:border-blue-500 text-sm w-48 sm:w-64" />
    </div>
  );

  /* Student detail panel view */
  if (selected) {
    return (
      <DashboardLayout title="Student Detail" actions={null}>
        <StudentDetailPanel
          student={selected}
          detail={detail}
          detailLoading={detailLoading}
          onBack={handleBack}
          onBlock={handleBlock}
          blockingId={blockingId}
        />
      </DashboardLayout>
    );
  }

  /* Students grid view */
  return (
    <DashboardLayout title={`Students (${students.length})`} actions={searchBar}>
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <div className="text-center"><div className="text-4xl mb-3 animate-pulse">👥</div><p className="text-sm">Loading students...</p></div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-2">👥</p>
          <p className="text-sm">{search ? 'No students match' : 'No students registered yet'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map(s => {
            const sid = s.id || s._id;
            return (
              <div key={sid} onClick={() => handleSelect(s)}
                className={`bg-gray-800/50 border border-slate-700/20 rounded-2xl p-4 cursor-pointer transition-all hover:-translate-y-0.5 hover:border-slate-600/40 hover:bg-gray-800/70
                  ${s.isBlocked ? 'opacity-60' : ''}`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0
                    ${s.isBlocked ? 'bg-red-800' : 'bg-gradient-to-br from-blue-500 to-purple-600'}`}>
                    {s.isBlocked ? '🚫' : s.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-white text-sm truncate">{s.name}</p>
                    <p className="text-gray-400 text-xs truncate">{s.email}</p>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  {s.rollNumber && <span className="text-xs text-gray-500">🎓 {s.rollNumber}</span>}
                  {s.isBlocked && (
                    <span className="text-xs bg-red-900/30 text-red-400 border border-red-800/30 px-2 py-0.5 rounded-full">Blocked</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
};

export default Students;
