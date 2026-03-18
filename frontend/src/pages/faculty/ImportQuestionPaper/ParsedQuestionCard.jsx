// src/pages/faculty/ImportQuestionPaper/ParsedQuestionCard.jsx
import { useState } from "react";

const DIFFICULTY_BORDER = {
  easy:   "border-l-green-500",
  medium: "border-l-yellow-500",
  hard:   "border-l-red-500",
};

const DIFFICULTY_BADGE = {
  easy:   "bg-green-900/40 text-green-300 border-green-700/40",
  medium: "bg-yellow-900/40 text-yellow-300 border-yellow-700/40",
  hard:   "bg-red-900/40 text-red-300 border-red-700/40",
};

const ParsedQuestionCard = ({ question, index, onUpdate, onDelete }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(question);

  const handleSave = () => {
    onUpdate(question.id, draft);
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(question);
    setEditing(false);
  };

  const diffBorder = DIFFICULTY_BORDER[question.difficulty] || DIFFICULTY_BORDER.medium;
  const diffBadge  = DIFFICULTY_BADGE[question.difficulty]  || DIFFICULTY_BADGE.medium;

  if (editing) {
    return (
      <div className={`bg-gray-800/60 border border-slate-700/30 border-l-4 ${DIFFICULTY_BORDER[draft.difficulty] || DIFFICULTY_BORDER.medium} rounded-xl p-4 space-y-3 fade-in`}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-blue-300 text-xs font-semibold">✏️ Editing Q{index + 1}</span>
          <div className="flex gap-1.5">
            <button onClick={handleSave} className="px-3 py-1 bg-green-600 hover:bg-green-500 rounded-lg text-xs font-semibold transition-colors">✓ Save</button>
            <button onClick={handleCancel} className="px-3 py-1 bg-white/8 hover:bg-white/12 rounded-lg text-xs transition-colors">Cancel</button>
          </div>
        </div>

        {/* Question text */}
        <textarea
          rows={2}
          value={draft.text}
          onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))}
          className="w-full bg-gray-900/60 text-white px-3 py-2 rounded-lg outline-none border border-white/10 focus:border-blue-500 resize-none text-sm"
          placeholder="Question text…"
        />

        {/* Options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {draft.options.map((opt, i) => (
            <div key={opt.id} className="flex items-center gap-2">
              <span className="text-blue-400 font-bold text-xs w-5 shrink-0">{opt.id}.</span>
              <input
                value={opt.text}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    options: d.options.map((o, j) => j === i ? { ...o, text: e.target.value } : o),
                  }))
                }
                className="flex-1 bg-gray-900/60 text-white px-2 py-1.5 rounded-lg outline-none border border-slate-700/20 focus:border-blue-500 text-xs"
                placeholder={`Option ${opt.id}`}
              />
            </div>
          ))}
        </div>

        {/* Metadata row */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Correct Answer</label>
            <select
              value={draft.answer}
              onChange={(e) => setDraft((d) => ({ ...d, answer: e.target.value }))}
              className="w-full bg-gray-900/60 text-white px-2 py-1.5 rounded-lg border border-white/10 text-xs outline-none"
            >
              {["A", "B", "C", "D"].map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Difficulty</label>
            <select
              value={draft.difficulty}
              onChange={(e) => setDraft((d) => ({ ...d, difficulty: e.target.value }))}
              className="w-full bg-gray-900/60 text-white px-2 py-1.5 rounded-lg border border-white/10 text-xs outline-none"
            >
              {["easy", "medium", "hard"].map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Marks</label>
            <input
              type="number"
              min={1}
              value={draft.marks}
              onChange={(e) => setDraft((d) => ({ ...d, marks: +e.target.value }))}
              className="w-full bg-gray-900/60 text-white px-2 py-1.5 rounded-lg border border-white/10 text-xs outline-none"
            />
          </div>
        </div>
      </div>
    );
  }

  /* ── View mode ── */
  return (
    <div className={`bg-gray-800/40 border border-slate-700/20 border-l-4 ${diffBorder} rounded-xl p-4 group hover:border-slate-600/40 transition-all`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-white text-sm font-medium leading-snug flex-1 min-w-0">
          <span className="text-gray-500 text-xs font-mono mr-1.5">Q{index + 1}.</span>
          {question.text || <span className="text-gray-500 italic">No text</span>}
        </p>
        <div className="flex gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => { setDraft(question); setEditing(true); }}
            title="Edit question"
            className="px-2 py-1 bg-blue-900/50 hover:bg-blue-800 rounded-lg text-xs transition-colors"
          >✏️</button>
          <button
            onClick={() => { if (confirm("Remove this question?")) onDelete(question.id); }}
            title="Delete question"
            className="px-2 py-1 bg-red-900/50 hover:bg-red-800 rounded-lg text-xs transition-colors"
          >🗑</button>
        </div>
      </div>

      {/* Options */}
      <div className="grid grid-cols-2 gap-1.5 mb-3">
        {question.options.map((opt) => (
          <div
            key={opt.id}
            className={`px-2.5 py-1.5 rounded-lg text-xs border ${
              opt.id === question.answer
                ? "bg-green-900/30 border-green-700/50 text-green-300"
                : "bg-white/4 border-white/5 text-gray-400"
            }`}
          >
            <span className="font-bold mr-1.5">{opt.id}.</span>
            {opt.text || <span className="italic opacity-50">empty</span>}
            {opt.id === question.answer && <span className="ml-1.5">✓</span>}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${diffBadge}`}>
          {question.difficulty}
        </span>
        <span className="text-gray-500 text-[10px]">· {question.marks} mark{question.marks !== 1 ? "s" : ""}</span>
        <span className={`ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded bg-green-900/20 text-green-400`}>
          ✓ {question.answer}
        </span>
      </div>
    </div>
  );
};

export default ParsedQuestionCard;
