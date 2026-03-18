// frontend/src/pages/faculty/AllExams.jsx
// Full exam history page with charts, category filters, and search.
// Accessible via "View All →" from the Faculty Dashboard MyExams section.
import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "../../components/DashboardLayout";
import api from "../../services/api";
import { toast } from "react-toastify";

/* ─── tiny inline chart helpers (no external charting lib) ────── */

/** Simple donut chart using SVG */
const DonutChart = ({ slices, size = 120, thickness = 22 }) => {
  const r = (size - thickness) / 2;
  const cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;
  const total = slices.reduce((s, sl) => s + sl.value, 0) || 1;
  let cumPct = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
      {slices.map((sl, i) => {
        const pct = sl.value / total;
        const dash = pct * circ;
        const gap  = circ - dash;
        const offset = cumPct * circ;
        cumPct += pct;
        return (
          <circle key={i} cx={cx} cy={cy} r={r}
            fill="none" stroke={sl.color} strokeWidth={thickness}
            strokeDasharray={`${dash} ${gap}`} strokeDashoffset={-offset}
            strokeLinecap="round" />
        );
      })}
      {/* background ring */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={thickness} />
    </svg>
  );
};

/** Horizontal bar (percentage fill) */
const BarRow = ({ label, value, max, color, icon }) => {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm w-4 shrink-0">{icon}</span>
      <span className="text-xs text-gray-400 w-20 shrink-0 capitalize">{label}</span>
      <div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden">
        <div className="h-2 rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-bold text-white w-6 text-right">{value}</span>
    </div>
  );
};

/* ─── Status badge ─────────────────────────────────────────────── */
const statusConfig = {
  draft:     { cls: "bg-gray-700/70 text-gray-300 border border-slate-600/30", dot: "bg-gray-400" },
  scheduled: { cls: "bg-yellow-900/40 text-yellow-300 border border-yellow-800/40", dot: "bg-yellow-400" },
  live:      { cls: "bg-green-900/40 text-green-400 border border-green-800/40 live-badge", dot: "bg-green-400 pulse-dot" },
  completed: { cls: "bg-blue-900/40 text-blue-400 border border-blue-800/40", dot: "bg-blue-400" },
};
const StatusBadge = ({ status }) => {
  const cfg = statusConfig[status] || statusConfig.draft;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />{status}
    </span>
  );
};

/* ─── Sort options ─────────────────────────────────────────────── */
const SORT_OPTIONS = [
  { key: "newest",    label: "Newest first" },
  { key: "oldest",    label: "Oldest first" },
  { key: "title",     label: "Title A→Z"    },
  { key: "status",    label: "By status"    },
];

/* ─── Main Page ────────────────────────────────────────────────── */
const AllExams = () => {
  const [exams,   setExams]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const [filter,  setFilter]  = useState("all");
  const [sort,    setSort]    = useState("newest");

  useEffect(() => {
    api.get("/exam/faculty")
      .then(res => { setExams(res.data.exams || []); setLoading(false); })
      .catch(() => { toast.error("Failed to load exams", { className: "custom-toast", bodyClassName: "custom-toast-body" }); setLoading(false); });
  }, []);

  /* ── Stats ─────────────────────────────────────────────────── */
  const stats = useMemo(() => ({
    total:     exams.length,
    draft:     exams.filter(e => e.status === "draft").length,
    live:      exams.filter(e => e.status === "live").length,
    completed: exams.filter(e => e.status === "completed").length,
    scheduled: exams.filter(e => e.status === "scheduled").length,
  }), [exams]);

  const donutSlices = [
    { value: stats.completed, color: "#3b82f6", label: "Completed" },
    { value: stats.live,      color: "#22c55e", label: "Live"      },
    { value: stats.draft,     color: "#6b7280", label: "Draft"     },
    { value: stats.scheduled, color: "#eab308", label: "Scheduled" },
  ];

  /* ── Filtered + sorted list ────────────────────────────────── */
  const displayed = useMemo(() => {
    let list = filter === "all" ? exams : exams.filter(e => e.status === filter);
    if (search) list = list.filter(e => e.title?.toLowerCase().includes(search.toLowerCase()));
    switch (sort) {
      case "oldest": list = [...list].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)); break;
      case "title":  list = [...list].sort((a, b) => (a.title || "").localeCompare(b.title || "")); break;
      case "status": list = [...list].sort((a, b) => (a.status || "").localeCompare(b.status || "")); break;
      default:       list = [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    return list;
  }, [exams, filter, search, sort]);

  const header = (
    <Link to="/faculty"
      className="text-xs px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-slate-700/20 rounded-lg text-gray-300 font-medium transition-colors">
      ← Dashboard
    </Link>
  );

  return (
    <DashboardLayout title="All Exams History" actions={header}>

      {/* ── Charts Row ─────────────────────────────────────────── */}
      {!loading && exams.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">

          {/* Donut */}
          <div className="bg-gray-800/50 border border-slate-700/20 rounded-2xl p-5">
            <h3 className="font-semibold text-white text-sm mb-4">📊 Status Breakdown</h3>
            <div className="flex items-center gap-6">
              <div className="relative shrink-0">
                <DonutChart slices={donutSlices} size={120} thickness={20} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-2xl font-bold text-white">{stats.total}</p>
                  <p className="text-[10px] text-gray-500">total</p>
                </div>
              </div>
              <div className="flex-1 space-y-2.5">
                {[
                  { label: "Completed", value: stats.completed, color: "#3b82f6", icon: "✅" },
                  { label: "Live",      value: stats.live,      color: "#22c55e", icon: "🟢" },
                  { label: "Draft",     value: stats.draft,     color: "#6b7280", icon: "📝" },
                  { label: "Scheduled", value: stats.scheduled, color: "#eab308", icon: "📅" },
                ].map(row => (
                  <BarRow key={row.label} {...row} max={stats.total} />
                ))}
              </div>
            </div>
          </div>

          {/* Summary stats */}
          <div className="bg-gray-800/50 border border-slate-700/20 rounded-2xl p-5">
            <h3 className="font-semibold text-white text-sm mb-4">📈 Quick Summary</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Total Exams",  val: stats.total,     icon: "📋", color: "text-white"        },
                { label: "Completion",   val: stats.total > 0 ? `${Math.round((stats.completed/stats.total)*100)}%` : "—", icon: "🎯", color: "text-green-400" },
                { label: "Live Now",     val: stats.live,      icon: "🔴", color: "text-green-400"   },
                { label: "In Draft",     val: stats.draft,     icon: "🗒️", color: "text-gray-300"    },
              ].map((card, i) => (
                <div key={i} className="bg-white/[0.03] border border-slate-700/15 rounded-xl p-3 text-center">
                  <div className="text-2xl mb-1">{card.icon}</div>
                  <div className={`text-xl font-bold ${card.color}`}>{card.val}</div>
                  <div className="text-gray-500 text-[10px] mt-0.5">{card.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Filters + Search + Sort ─────────────────────────────── */}
      <div className="bg-gray-800/50 border border-slate-700/20 rounded-2xl p-5">

        <div className="flex flex-wrap gap-3 items-center justify-between mb-4">
          <h3 className="font-semibold text-white">
            All Exams
            <span className="ml-2 text-xs text-gray-500 font-normal">({displayed.length} shown)</span>
          </h3>

          <div className="flex flex-wrap gap-2 items-center">
            {/* Sort */}
            <select
              value={sort}
              onChange={e => setSort(e.target.value)}
              className="bg-gray-900/60 border border-slate-700/25 rounded-lg px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-600/50 cursor-pointer"
            >
              {SORT_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>

            {/* Category tabs */}
            <div className="flex bg-gray-900/60 rounded-lg p-0.5 gap-0.5 border border-slate-700/20">
              {["all", "draft", "live", "completed", "scheduled"].map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                    filter === f ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"}`}>
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search exams by name or title…"
            className="w-full bg-gray-900/60 border border-slate-700/25 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-600/50 focus:bg-gray-900/90 transition-colors" />
          {search && (
            <button onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-sm">✕</button>
          )}
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-3xl mb-3 animate-pulse">⏳</div>
            <p className="text-sm">Loading all exams…</p>
          </div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-sm">{search ? `No exams match "${search}"` : `No ${filter === "all" ? "" : filter} exams.`}</p>
            {filter === "all" && !search && (
              <Link to="/faculty/exam-config" className="text-blue-400 text-sm hover:underline mt-2 inline-block">Create your first exam →</Link>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {displayed.map(exam => {
              const examId = exam.id;
              return (
                <div key={examId}
                  className="flex items-start justify-between bg-white/[0.025] hover:bg-white/4 border border-slate-700/20 rounded-xl px-4 py-3.5 gap-4 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-white text-sm truncate">{exam.title}</span>
                      <StatusBadge status={exam.status} />
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-gray-500 text-xs">
                      <span>⏱ {exam.duration}min</span>
                      <span>❓ {exam.questions?.length || 0}q</span>
                      {exam.questionPaperTitle && <span className="hidden sm:inline">📄 {exam.questionPaperTitle}</span>}
                      {exam.createdAt && (
                        <span className="text-gray-600">
                          {new Date(exam.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                    {(exam.status === "live" || exam.status === "completed") && (
                      <Link to={`/faculty/monitor/${examId}`}
                        className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 rounded-lg text-xs font-semibold transition-colors">
                        {exam.status === "live" ? "👁 Monitor" : "📊 Results"}
                      </Link>
                    )}
                    {exam.status === "draft" && (
                      <Link to={`/faculty/exam-config`}
                        className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded-lg text-xs font-semibold transition-colors">
                        ✏️ Edit
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination hint */}
        {!loading && exams.length > 0 && (
          <p className="mt-4 text-xs text-gray-600 text-center">
            {displayed.length} of {exams.length} exams • sorted by {SORT_OPTIONS.find(o => o.key === sort)?.label}
          </p>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AllExams;
