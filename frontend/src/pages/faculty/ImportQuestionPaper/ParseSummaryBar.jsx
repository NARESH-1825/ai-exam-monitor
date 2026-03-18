// src/pages/faculty/ImportQuestionPaper/ParseSummaryBar.jsx

const DIFF_CONFIG = {
  easy:   { color: "text-green-400",  bg: "bg-green-900/30 border-green-700/40",  dot: "bg-green-400"  },
  medium: { color: "text-yellow-400", bg: "bg-yellow-900/30 border-yellow-700/40", dot: "bg-yellow-400" },
  hard:   { color: "text-red-400",    bg: "bg-red-900/30 border-red-700/40",       dot: "bg-red-400"    },
};

const ParseSummaryBar = ({ questions }) => {
  if (!questions || questions.length === 0) return null;

  const easy   = questions.filter((q) => q.difficulty === "easy").length;
  const medium = questions.filter((q) => q.difficulty === "medium").length;
  const hard   = questions.filter((q) => q.difficulty === "hard").length;
  const totalMarks = questions.reduce((sum, q) => sum + (q.marks || 1), 0);

  const stats = [
    { label: "Total Questions", value: questions.length, color: "text-blue-300",   bg: "bg-blue-900/30 border-blue-700/40"   },
    { label: "Easy",            value: easy,              ...DIFF_CONFIG.easy   },
    { label: "Medium",          value: medium,            ...DIFF_CONFIG.medium },
    { label: "Hard",            value: hard,              ...DIFF_CONFIG.hard   },
    { label: "Total Marks",     value: totalMarks,        color: "text-purple-300", bg: "bg-purple-900/30 border-purple-700/40" },
  ];

  return (
    <div className="flex flex-wrap gap-2 p-3 bg-gray-800/40 border border-slate-700/20 rounded-xl mb-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${s.bg}`}
        >
          {s.dot && <span className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />}
          <span className="text-gray-400">{s.label}:</span>
          <span className={`font-bold ${s.color}`}>{s.value}</span>
        </div>
      ))}
    </div>
  );
};

export default ParseSummaryBar;
