// frontend/src/pages/faculty/Dashboard.jsx
import { useEffect, useState, useRef } from "react";
import { useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import DashboardLayout from "../../components/DashboardLayout";
import api from "../../services/api";
import { toast } from "react-toastify";

const RECENT_LIMIT = 5;

/* ── Page close countdown ─────────────────────────────────────── */
const PageCloseTimer = ({ startTime, pageCloseTime }) => {
  const [secs, setSecs] = useState(null);
  useEffect(() => {
    if (!pageCloseTime || pageCloseTime <= 0 || !startTime) return;
    const closeMs = new Date(startTime).getTime() + pageCloseTime * 60 * 1000;
    const calc = () => { const r = Math.max(0, Math.floor((closeMs - Date.now()) / 1000)); setSecs(r); return r; };
    if (calc() <= 0) return;
    const t = setInterval(() => { if (calc() <= 0) clearInterval(t); }, 1000);
    return () => clearInterval(t);
  }, [startTime, pageCloseTime]);
  if (secs === null || pageCloseTime <= 0) return null;
  const m = Math.floor(secs / 60), s = secs % 60;
  return (
    <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
      secs === 0 ? "text-gray-500 bg-gray-700"
        : secs < 300 ? "text-red-300 bg-red-900/30 border border-red-800"
        : "text-purple-300 bg-purple-900/30 border border-purple-800"}`}>
      🏫 {secs === 0 ? "Page closed" : `Closes ${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`}
    </span>
  );
};

/* ── Status badge ─────────────────────────────────────────────── */
const statusConfig = {
  draft:     { cls: "bg-gray-700/70 text-gray-300 border border-slate-600/30",       dot: "bg-gray-400" },
  scheduled: { cls: "bg-yellow-900/40 text-yellow-300 border border-yellow-800/40 scheduled-badge", dot: "bg-yellow-400" },
  live:      { cls: "bg-green-900/40 text-green-400 border border-green-800/40 live-badge",         dot: "bg-green-400 pulse-dot live-ring" },
  completed: { cls: "bg-blue-900/40 text-blue-400 border border-blue-800/40",        dot: "bg-blue-400" },
};
const StatusBadge = ({ status }) => {
  const cfg = statusConfig[status] || statusConfig.draft;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${status === "live" ? "pulse-dot" : ""}`} />
      {status}
    </span>
  );
};

/* ── Exam row ─────────────────────────────────────────────────── */
const ExamRow = ({ exam, onLaunch, onEnd }) => {
  const examId = exam.id;
  return (
    <div className="flex items-start justify-between bg-white/[0.025] hover:bg-white/4 border border-slate-700/20 rounded-xl px-4 py-3.5 gap-4 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="font-semibold text-white text-sm truncate">{exam.title}</span>
          <StatusBadge status={exam.status} />
        </div>
        <div className="flex flex-wrap items-center gap-3 text-gray-500 text-xs">
          <span>⏱ {exam.duration}min</span>
          {exam.pageCloseTime > 0 && <span className="text-purple-400">🏫 {exam.pageCloseTime}min</span>}
          <span>❓ {exam.questions?.length || 0}q</span>
          {exam.questionPaperTitle && <span className="hidden md:inline">📄 {exam.questionPaperTitle}</span>}
        </div>
        {exam.status === "live" && exam.pageCloseTime > 0 && (
          <div className="mt-1.5">
            <PageCloseTimer startTime={exam.startTime} pageCloseTime={exam.pageCloseTime} />
          </div>
        )}
      </div>
      <div className="flex gap-2 shrink-0 flex-wrap justify-end">
        {exam.status === "draft" && (
          <button onClick={() => onLaunch(examId)}
            className="px-3 py-1.5 bg-green-700 hover:bg-green-600 rounded-lg text-xs font-semibold transition-colors">
            🚀 Launch
          </button>
        )}
        {exam.status === "live" && (
          <>
            <Link to={`/faculty/monitor/${examId}`}
              className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 rounded-lg text-xs font-semibold transition-colors">
              👁 Monitor
            </Link>
            <button onClick={() => onEnd(examId)}
              className="px-3 py-1.5 bg-red-700 hover:bg-red-600 rounded-lg text-xs font-semibold transition-colors">
              ⏹ End
            </button>
          </>
        )}
        {exam.status === "completed" && (
          <Link to={`/faculty/monitor/${examId}`}
            className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded-lg text-xs font-semibold transition-colors">
            📊 Results
          </Link>
        )}
      </div>
    </div>
  );
};

/* ── Main ─────────────────────────────────────────────────────── */
const FacultyDashboard = () => {
  const { user } = useSelector(s => s.auth);
  const navigate = useNavigate();
  const [exams,    setExams]    = useState([]);
  const [students, setStudents] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState("recent");
  const [search,   setSearch]   = useState("");

  useEffect(() => {
    Promise.all([api.get("/exam/faculty"), api.get("/faculty/students")])
      .then(([examRes, studentRes]) => {
        setExams(examRes.data.exams || []);
        setStudents(studentRes.data.students || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleLaunch = async (examId) => {
    if (!examId) { toast.error("Invalid exam ID", { className: "custom-toast", bodyClassName: "custom-toast-body" }); return; }
    try {
      await api.put(`/exam/${examId}/launch`);
      const res = await api.get("/exam/faculty");
      setExams(res.data.exams || []);
      toast.success("Exam is now LIVE! 🚀", { className: "custom-toast", bodyClassName: "custom-toast-body" });
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to launch", { className: "custom-toast", bodyClassName: "custom-toast-body" });
    }
  };

  const handleEnd = async (examId) => {
    if (!examId) { toast.error("Invalid exam ID", { className: "custom-toast", bodyClassName: "custom-toast-body" }); return; }
    if (!confirm("End this exam? All ongoing students will be auto-submitted.")) return;
    try {
      await api.put(`/exam/${examId}/end`);
      setExams(prev => prev.map(e => e.id === examId ? { ...e, status: "completed" } : e));
      toast.success("Exam ended. Students auto-submitted.", { className: "custom-toast", bodyClassName: "custom-toast-body" });
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to end exam", { className: "custom-toast", bodyClassName: "custom-toast-body" });
    }
  };

  const statCards = [
    { label: "Total Exams", val: exams.length,                                      icon: "📋", color: "text-blue-400",   bg: "from-blue-900/30 to-blue-800/10",   border: "border-blue-900/40"   },
    { label: "Live Now",    val: exams.filter(e => e.status === "live").length,      icon: "🟢", color: "text-green-400",  bg: "from-green-900/30 to-green-800/10", border: "border-green-900/40" },
    { label: "Students",    val: students.length,                                   icon: "👥", color: "text-yellow-400", bg: "from-yellow-900/30 to-yellow-800/10",border: "border-yellow-900/40"},
    { label: "Completed",   val: exams.filter(e => e.status === "completed").length, icon: "✅", color: "text-purple-400", bg: "from-purple-900/30 to-purple-800/10",border: "border-purple-900/40"},
  ];

  const quickActions = [
    { to: "/faculty/questions",   icon: "📚", label: "Question Bank", desc: "Manage MCQ papers"        },
    { to: "/faculty/exam-config", icon: "⚙️", label: "Create Exam",   desc: "Configure & schedule"     },
    { to: "/faculty/students",    icon: "👥", label: "View Students", desc: "Manage enrolled students"  },
  ];

  // Filter + search logic
  const searchLower = search.toLowerCase();
  let displayExams = filter === "recent"
    ? [...exams].slice(0, RECENT_LIMIT)
    : exams.filter(e => e.status === filter);

  if (search) {
    displayExams = displayExams.filter(e => e.title?.toLowerCase().includes(searchLower));
  }

  const header = (
    <Link to="/faculty/exam-config"
      className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors text-white">
      + Create Exam
    </Link>
  );

  return (
    <DashboardLayout title="Faculty Dashboard" actions={header}>

      {/* Welcome */}
      <div className="bg-gradient-to-r from-purple-900/35 to-blue-900/25 border border-purple-800/20 rounded-2xl p-5 mb-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">Welcome, {user?.name?.split(" ")[0]}! 👋</h2>
          <p className="text-purple-200 text-sm mt-0.5">Manage your exams, questions, and monitor students</p>
        </div>
        <div className="flex gap-2">
          <Link to="/faculty/exam-config"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-semibold transition-all">
            ⚙️ New Exam
          </Link>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {statCards.map((s, i) => (
          <div key={i} className={`bg-gradient-to-br ${s.bg} rounded-xl p-4 text-center border ${s.border}`}>
            <div className="text-xl mb-1">{s.icon}</div>
            <div className={`text-2xl font-bold ${s.color}`}>{s.val}</div>
            <div className="text-gray-400 text-xs mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions — 1 col on mobile, 3 cols on desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        {quickActions.map(({ to, icon, label, desc }) => (
          <Link key={to} to={to}
            className="bg-gray-800/50 hover:bg-gray-800 border border-slate-700/20 hover:border-slate-600/40 rounded-xl p-4 flex sm:flex-col items-center sm:text-center gap-3 transition-all group hover:-translate-y-0.5">
            <div className="text-2xl group-hover:scale-110 transition-transform shrink-0">{icon}</div>
            <div className="sm:text-center text-left">
              <p className="font-semibold text-white text-sm">{label}</p>
              <p className="text-gray-500 text-xs mt-0.5">{desc}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* My Exams — Recent 5 + search + filter tabs */}
      <div className="bg-gray-800/50 border border-slate-700/20 rounded-2xl p-5">

        {/* Header row */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="font-semibold text-white">My Exams</h3>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter tabs */}
            <div className="flex bg-gray-900/60 rounded-lg p-0.5 gap-0.5 border border-slate-700/20">
              {["recent", "draft", "live", "completed"].map(f => (
                <button key={f} onClick={() => { setFilter(f); setSearch(""); }}
                  className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                    filter === f ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"}`}>
                  {f}
                </button>
              ))}
            </div>
            {/* View All */}
            <Link to="/faculty/all-exams"
              className="text-xs px-3 py-1 bg-white/5 hover:bg-white/10 border border-slate-700/20 rounded-lg text-blue-400 hover:text-blue-300 font-medium transition-colors">
              View All →
            </Link>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative mb-4">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search exams by name…"
            className="w-full bg-gray-900/60 border border-slate-700/25 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-600/50 focus:bg-gray-900/90 transition-colors"
          />
          {search && (
            <button onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-sm">
              ✕
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-10 text-gray-400 text-sm">
            <div className="text-2xl mb-2 animate-pulse">⏳</div> Loading exams...
          </div>
        ) : displayExams.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <p className="text-3xl mb-2">📋</p>
            <p className="text-sm">{search ? `No exams match "${search}"` : filter === "recent" ? "No exams yet." : `No ${filter} exams.`}</p>
            {filter === "recent" && !search && (
              <Link to="/faculty/exam-config" className="text-blue-400 text-sm hover:underline mt-1 inline-block">Create one →</Link>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {displayExams.map(exam => (
              <ExamRow key={exam.id} exam={exam} onLaunch={handleLaunch} onEnd={handleEnd} />
            ))}
          </div>
        )}

        {/* Footer: count + view all hint */}
        {!loading && (
          <div className="mt-4 flex items-center justify-between text-xs text-gray-600">
            <span>
              Showing {displayExams.length} of {filter === "recent" ? exams.length : exams.filter(e => e.status === filter).length} exams
            </span>
            <Link to="/faculty/all-exams" className="text-blue-500 hover:text-blue-400 font-medium transition-colors">
              Full history + charts →
            </Link>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default FacultyDashboard;
