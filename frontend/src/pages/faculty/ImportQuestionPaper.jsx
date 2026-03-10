// frontend/src/pages/faculty/ImportQuestionPaper.jsx
import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../components/DashboardLayout";
import api from "../../services/api";
import { toast } from "react-toastify";

/* ── Demo format cards ────────────────────────────────────────── */
const DEMO_FORMATS = [
  {
    icon: "📄",
    label: "PDF / DOCX",
    color: "from-red-500/20 to-orange-500/10 border-red-700/30",
    accent: "text-red-400",
    code: `Q1. What is Artificial Intelligence?
A. Machine Learning
B. All of the above
C. Data Science
D. Robotics
Answer: B
Marks: 2

Q2. Who invented the telephone?
A. Newton  B. Edison
C. Bell    D. Tesla
Answer: C
Marks: 1`,
  },
  {
    icon: "📊",
    label: "Excel (XLSX / XLS)",
    color: "from-green-500/20 to-emerald-500/10 border-green-700/30",
    accent: "text-green-400",
    code: `| Question          | A   | B   | C     | D   | Answer | Marks |
|-------------------|-----|-----|-------|-----|--------|-------|
| What is 2 + 2?    | 3   | 4   | 5     | 6   | B      | 1     |
| Capital of India? | Mum | Del | Chen  | Kol | B      | 2     |`,
  },
  {
    icon: "📋",
    label: "CSV",
    color: "from-blue-500/20 to-cyan-500/10 border-blue-700/30",
    accent: "text-blue-400",
    code: `question,A,B,C,D,answer,marks
What is AI?,Machine Learning,Deep Learning,Both,None,C,1
Capital of India?,Mumbai,Delhi,Chennai,Kolkata,B,2`,
  },
];

/* ── Editable Question Row ────────────────────────────────────── */
const EditableRow = ({ q, idx, onChange, onDelete }) => {
  const update = (field, val) => onChange(idx, { ...q, [field]: val });
  const updateOpt = (optId, text) =>
    onChange(idx, {
      ...q,
      options: q.options.map((o) => (o.id === optId ? { ...o, text } : o)),
    });

  return (
    <tr className="border-b border-slate-700/20 hover:bg-white/[0.02] transition-colors group">
      {/* # */}
      <td className="px-3 py-2 text-center text-gray-500 text-xs font-mono">{idx + 1}</td>

      {/* Question text */}
      <td className="px-3 py-2">
        <textarea
          rows={2}
          value={q.text}
          onChange={(e) => update("text", e.target.value)}
          className="w-full min-w-[180px] bg-gray-900/60 text-white text-xs px-2 py-1.5 rounded-lg border border-slate-700/20 focus:border-blue-500 outline-none resize-none"
          placeholder="Question text..."
        />
      </td>

      {/* Options A-D */}
      {["A", "B", "C", "D"].map((id) => {
        const opt = q.options.find((o) => o.id === id) || { id, text: "" };
        return (
          <td key={id} className="px-2 py-2">
            <input
              value={opt.text}
              onChange={(e) => updateOpt(id, e.target.value)}
              placeholder={`Option ${id}`}
              className={`w-full min-w-[90px] text-xs px-2 py-1.5 rounded-lg border outline-none transition-colors
                ${q.answer === id
                  ? "bg-green-900/30 border-green-600/50 text-green-300"
                  : "bg-gray-900/60 border-slate-700/20 text-gray-300 focus:border-blue-500"
                }`}
            />
          </td>
        );
      })}

      {/* Correct Answer */}
      <td className="px-2 py-2">
        <select
          value={q.answer}
          onChange={(e) => update("answer", e.target.value)}
          className="w-full bg-gray-900/60 text-white text-xs px-2 py-1.5 rounded-lg border border-slate-700/20 outline-none focus:border-blue-500"
        >
          {["A", "B", "C", "D"].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </td>

      {/* Marks */}
      <td className="px-2 py-2">
        <input
          type="number"
          min={1}
          value={q.marks}
          onChange={(e) => update("marks", Math.max(1, parseInt(e.target.value) || 1))}
          className="w-16 bg-gray-900/60 text-white text-xs px-2 py-1.5 rounded-lg border border-slate-700/20 outline-none focus:border-blue-500 text-center"
        />
      </td>

      {/* Delete */}
      <td className="px-2 py-2 text-center">
        <button
          onClick={() => onDelete(idx)}
          title="Remove question"
          className="text-red-500 hover:text-red-300 hover:bg-red-900/30 rounded-lg p-1 transition-colors opacity-0 group-hover:opacity-100"
        >
          🗑
        </button>
      </td>
    </tr>
  );
};

/* ── Main Component ───────────────────────────────────────────── */
const ImportQuestionPaper = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fileName, setFileName] = useState("");
  const [questions, setQuestions] = useState([]);
  const [paperTitle, setPaperTitle] = useState("");

  /* ── Upload handler ──────────────────────────────────────────── */
  const handleFile = useCallback(async (file) => {
    if (!file) return;

    const allowed = /\.(pdf|xlsx|xls|doc|docx|csv)$/i;
    if (!allowed.test(file.name)) {
      toast.error("Unsupported format. Use PDF, XLSX, XLS, DOCX, DOC, or CSV.", {
        className: "custom-toast",
        bodyClassName: "custom-toast-body",
      });
      return;
    }

    setFileName(file.name);
    setUploading(true);
    setQuestions([]);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const { data } = await api.post("/faculty/import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setQuestions(data.questions || []);
      // Auto-suggest paper title from filename (strip extension)
      if (!paperTitle) {
        setPaperTitle(file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "));
      }
      toast.success(`✅ Extracted ${data.count} question(s) from ${file.name}`, {
        className: "custom-toast",
        bodyClassName: "custom-toast-body",
      });
    } catch (err) {
      const msg =
        err.response?.data?.message || "Failed to parse file. Check the format.";
      toast.error(msg, { className: "custom-toast", bodyClassName: "custom-toast-body" });
    }
    setUploading(false);
  }, [paperTitle]);

  /* ── Drag helpers ────────────────────────────────────────────── */
  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const onDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);

  /* ── Question edit helpers ───────────────────────────────────── */
  const handleQuestionChange = (idx, updated) => {
    setQuestions((prev) => prev.map((q, i) => (i === idx ? updated : q)));
  };

  const handleDelete = (idx) => {
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
    toast.info("Question removed", { className: "custom-toast", bodyClassName: "custom-toast-body" });
  };

  /* ── Save to Question Bank ───────────────────────────────────── */
  const handleSave = async () => {
    if (!paperTitle.trim()) {
      toast.error("Please enter a paper title.", { className: "custom-toast", bodyClassName: "custom-toast-body" });
      return;
    }
    if (questions.length === 0) {
      toast.error("No questions to save.", { className: "custom-toast", bodyClassName: "custom-toast-body" });
      return;
    }

    // Validate questions
    const invalid = questions.findIndex((q) => !q.text.trim());
    if (invalid !== -1) {
      toast.error(`Question ${invalid + 1} has empty text.`, { className: "custom-toast", bodyClassName: "custom-toast-body" });
      return;
    }

    setSaving(true);
    try {
      // Normalise each question to the schema used by PaperDrawer
      const normalized = questions.map((q) => ({
        text: q.text.trim(),
        options: q.options.map((o) => ({ id: o.id, text: o.text.trim() })),
        answer: q.answer,
        marks: q.marks || 1,
        difficulty: q.difficulty || "medium",
        id: Date.now().toString() + Math.random().toString(36).slice(2),
      }));

      await api.post("/faculty/papers", { title: paperTitle.trim(), questions: normalized });
      toast.success("✅ Paper saved to Question Bank!", { className: "custom-toast", bodyClassName: "custom-toast-body" });
      navigate("/faculty/questions");
    } catch (err) {
      toast.error(err.response?.data?.message || "Save failed.", { className: "custom-toast", bodyClassName: "custom-toast-body" });
    }
    setSaving(false);
  };

  /* ── Render ──────────────────────────────────────────────────── */
  const totalMarks = questions.reduce((s, q) => s + (q.marks || 1), 0);

  return (
    <DashboardLayout
      title="📥 Import Question Paper"
      actions={
        questions.length > 0 && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-xs px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-lg font-medium text-white transition-colors"
          >
            {saving ? "⏳ Saving…" : "💾 Save to Bank"}
          </button>
        )
      }
    >
      <div className="space-y-6">

        {/* ── Upload zone ────────────────────────────────────────── */}
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-2xl py-10 px-6 cursor-pointer transition-all duration-200
            ${dragging
              ? "border-blue-400 bg-blue-900/20 scale-[1.01]"
              : "border-slate-700/40 bg-gray-800/30 hover:border-blue-600/50 hover:bg-gray-800/50"
            }
            ${uploading ? "pointer-events-none opacity-70" : ""}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.xlsx,.xls,.doc,.docx,.csv"
            className="hidden"
            onChange={(e) => handleFile(e.target.files[0])}
          />

          {uploading ? (
            <>
              <div className="text-4xl animate-spin">⚙️</div>
              <p className="text-blue-300 font-medium text-sm">Parsing {fileName}…</p>
              <p className="text-gray-500 text-xs">Extracting questions, please wait</p>
            </>
          ) : (
            <>
              <div className="text-5xl select-none">📁</div>
              <div className="text-center">
                <p className="text-white font-semibold text-sm mb-1">
                  Drag & drop your question paper here
                </p>
                <p className="text-gray-400 text-xs">or click to browse</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 mt-1">
                {["PDF","XLSX","XLS","DOCX","DOC","CSV"].map((ext) => (
                  <span key={ext} className="px-2.5 py-0.5 bg-white/6 border border-slate-700/30 rounded-full text-xs text-gray-400 font-mono">
                    .{ext.toLowerCase()}
                  </span>
                ))}
              </div>
              {fileName && !uploading && questions.length > 0 && (
                <p className="text-green-400 text-xs mt-1">
                  ✓ Last imported: {fileName}
                </p>
              )}
            </>
          )}
        </div>

        {/* ── Demo format cards ───────────────────────────────────── */}
        <div>
          <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
            <span>📖</span> Accepted File Formats & Required Structure
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {DEMO_FORMATS.map((fmt) => (
              <div
                key={fmt.label}
                className={`rounded-xl border p-4 bg-gradient-to-br ${fmt.color}`}
              >
                <div className={`flex items-center gap-2 mb-2 font-semibold text-sm ${fmt.accent}`}>
                  <span>{fmt.icon}</span>
                  <span>{fmt.label}</span>
                </div>
                <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap break-words bg-black/30 rounded-lg p-2.5 leading-relaxed overflow-x-auto">
                  {fmt.code}
                </pre>
              </div>
            ))}
          </div>
        </div>

        {/* ── Extracted questions preview ─────────────────────────── */}
        {questions.length > 0 && (
          <div className="space-y-4">
            {/* Stats bar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="bg-blue-900/40 border border-blue-800/40 text-blue-300 text-xs font-semibold px-3 py-1 rounded-full">
                  {questions.length} Questions
                </span>
                <span className="bg-purple-900/40 border border-purple-800/40 text-purple-300 text-xs font-semibold px-3 py-1 rounded-full">
                  {totalMarks} Total Marks
                </span>
              </div>
              <button
                onClick={() => { setQuestions([]); setFileName(""); }}
                className="text-xs text-gray-400 hover:text-red-400 transition-colors"
              >
                ✕ Clear all
              </button>
            </div>

            {/* Paper title input */}
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block font-medium">
                Paper Title <span className="text-red-400">*</span>
              </label>
              <input
                placeholder="e.g. Unit Test 1 – Computer Science"
                value={paperTitle}
                onChange={(e) => setPaperTitle(e.target.value)}
                className="w-full max-w-lg bg-gray-800/60 text-white px-4 py-2.5 rounded-xl outline-none border border-slate-700/20 focus:border-blue-500 text-sm"
              />
            </div>

            {/* Editable table */}
            <div className="overflow-x-auto rounded-xl border border-slate-700/20">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-800/60 text-gray-400 text-xs">
                    <th className="px-3 py-2.5 w-10 text-center">#</th>
                    <th className="px-3 py-2.5 min-w-[200px]">Question</th>
                    {["A","B","C","D"].map((l) => (
                      <th key={l} className="px-2 py-2.5 min-w-[100px]">Option {l}</th>
                    ))}
                    <th className="px-2 py-2.5 w-20">Answer</th>
                    <th className="px-2 py-2.5 w-16">Marks</th>
                    <th className="px-2 py-2.5 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {questions.map((q, idx) => (
                    <EditableRow
                      key={idx}
                      q={q}
                      idx={idx}
                      onChange={handleQuestionChange}
                      onDelete={handleDelete}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Save button (also in header actions, but repeat here for convenience) */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2"
              >
                {saving ? (
                  <>⏳ Saving…</>
                ) : (
                  <>💾 Save to Question Bank</>
                )}
              </button>
              <button
                onClick={() => navigate("/faculty/questions")}
                className="px-6 py-2.5 bg-white/8 hover:bg-white/12 rounded-xl text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ImportQuestionPaper;
