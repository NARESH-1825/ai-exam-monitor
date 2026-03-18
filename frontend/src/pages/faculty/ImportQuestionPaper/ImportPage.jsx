// src/pages/faculty/ImportQuestionPaper/ImportPage.jsx
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../../components/DashboardLayout";
import api from "../../../services/api";
import { toast } from "react-toastify";
import useQuestionParser from "../../../hooks/useQuestionParser";

/* ─────────────────────────────────────────────────────────────────
   FORMAT CARDS DATA
───────────────────────────────────────────────────────────────── */
const FORMAT_CARDS = [
  {
    ext: "TXT", icon: "📄",
    color: "border-blue-700/50 bg-blue-950/60",
    iconBg: "bg-blue-800/60", textColor: "text-blue-300",
    desc: "Plain text with Q/A blocks separated by blank lines.",
    example: `Q1. What is 2+2?\nA) 3\nB) 4\nC) 5\nD) 6\nAnswer: B\nDifficulty: easy\nMarks: 1`,
  },
  {
    ext: "CSV", icon: "📊",
    color: "border-green-700/50 bg-green-950/60",
    iconBg: "bg-green-800/60", textColor: "text-green-300",
    desc: "Columns: question, A, B, C, D, answer, difficulty, marks.",
    example: `question,A,B,C,D,answer,difficulty,marks\n"Capital?",Berlin,Madrid,Paris,Rome,C,easy,1`,
  },
  {
    ext: "XLSX", icon: "📗",
    color: "border-emerald-700/50 bg-emerald-950/60",
    iconBg: "bg-emerald-800/60", textColor: "text-emerald-300",
    desc: "Excel file — same column structure as CSV. First sheet used.",
    example: `question | A | B | C | D | answer | difficulty | marks`,
  },
  {
    ext: "DOCX", icon: "📝",
    color: "border-indigo-700/50 bg-indigo-950/60",
    iconBg: "bg-indigo-800/60", textColor: "text-indigo-300",
    desc: "Word doc — same Q/A block format as TXT, blank lines between questions.",
    example: `Q1. Largest planet?\nA) Earth  B) Mars\nC) Jupiter  D) Saturn\nAns: C`,
  },
  {
    ext: "PDF", icon: "📕",
    color: "border-red-700/50 bg-red-950/60",
    iconBg: "bg-red-800/60", textColor: "text-red-300",
    desc: "Digital PDFs are parsed directly. Scanned PDFs use OCR automatically.",
    example: `Works best with digital (text-based) PDFs.\nScanned PDFs: OCR applied automatically.`,
  },
  {
    ext: "IMG", icon: "🖼️",
    color: "border-purple-700/50 bg-purple-950/60",
    iconBg: "bg-purple-800/60", textColor: "text-purple-300",
    desc: "PNG, JPG, JPEG — questions extracted via OCR. Use clean printed text.",
    example: `Supported: .png .jpg .jpeg\nBest: printed text, high contrast, clean background.`,
  },
];

const DIFF_BORDER  = { easy: "border-l-green-500",  medium: "border-l-yellow-500", hard: "border-l-red-500"  };
const DIFF_BADGE   = { easy: "bg-green-900/50 text-green-300 border-green-700/50", medium: "bg-yellow-900/50 text-yellow-300 border-yellow-700/50", hard: "bg-red-900/50 text-red-300 border-red-700/50" };

/* ─────────────────────────────────────────────────────────────────
   SUMMARY BAR
───────────────────────────────────────────────────────────────── */
const SummaryBar = ({ questions }) => {
  const easy   = questions.filter(q => q.difficulty === "easy").length;
  const medium = questions.filter(q => q.difficulty === "medium").length;
  const hard   = questions.filter(q => q.difficulty === "hard").length;
  const marks  = questions.reduce((s, q) => s + (q.marks || 1), 0);
  return (
    <div className="flex flex-wrap gap-2 px-5 py-3 bg-gray-900/60 border-b border-slate-700/20">
      {[
        { label: "Total Questions", val: questions.length, cls: "text-blue-300" },
        { label: "Easy",   val: easy,   cls: "text-green-400",  dot: "bg-green-400"  },
        { label: "Medium", val: medium, cls: "text-yellow-400", dot: "bg-yellow-400" },
        { label: "Hard",   val: hard,   cls: "text-red-400",    dot: "bg-red-400"    },
        { label: "Total Marks", val: marks, cls: "text-purple-300" },
      ].map(s => (
        <div key={s.label} className="flex items-center gap-1.5 text-xs">
          {s.dot && <span className={`w-2 h-2 rounded-full ${s.dot}`}/>}
          <span className="text-gray-400">{s.label}:</span>
          <span className={`font-bold ${s.cls}`}>{s.val}</span>
        </div>
      ))}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────────
   QUESTION CARD (Review phase — show+edit)
───────────────────────────────────────────────────────────────── */
const QuestionCard = ({ q, index, onUpdate, onDelete }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(q);

  const save = () => { onUpdate(q.id, draft); setEditing(false); };
  const cancel = () => { setDraft(q); setEditing(false); };

  if (editing) return (
    <div className={`bg-gray-800/70 border border-slate-700/30 border-l-4 ${DIFF_BORDER[draft.difficulty]||DIFF_BORDER.medium} rounded-xl p-4 space-y-3`}>
      <div className="flex justify-between items-center">
        <span className="text-blue-300 text-xs font-semibold">✏️ Edit Q{index+1}</span>
        <div className="flex gap-1.5">
          <button onClick={save} className="px-3 py-1 bg-green-600 hover:bg-green-500 rounded-lg text-xs font-bold">✓ Save</button>
          <button onClick={cancel} className="px-3 py-1 bg-white/8 hover:bg-white/12 rounded-lg text-xs">✕</button>
        </div>
      </div>
      <textarea rows={2} value={draft.text} onChange={e=>setDraft(d=>({...d,text:e.target.value}))}
        className="w-full bg-gray-900/70 text-white px-3 py-2 rounded-lg border border-white/10 focus:border-blue-500 outline-none resize-none text-sm"/>
      <div className="grid grid-cols-2 gap-2">
        {draft.options.map((opt,i)=>(
          <div key={opt.id} className="flex gap-2 items-center">
            <span className="text-blue-400 font-bold text-xs w-5">{opt.id}.</span>
            <input value={opt.text} onChange={e=>setDraft(d=>({...d,options:d.options.map((o,j)=>j===i?{...o,text:e.target.value}:o)}))}
              className="flex-1 bg-gray-900/70 text-white px-2 py-1.5 rounded-lg border border-white/10 focus:border-blue-500 outline-none text-xs"/>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[{label:"Correct",key:"answer",opts:["A","B","C","D"]},{label:"Difficulty",key:"difficulty",opts:["easy","medium","hard"]},{label:"Marks",key:"marks",type:"number"}].map(f=>(
          <div key={f.key}>
            <label className="text-xs text-gray-400 block mb-1">{f.label}</label>
            {f.type==="number"
              ? <input type="number" min={1} value={draft[f.key]} onChange={e=>setDraft(d=>({...d,[f.key]:+e.target.value}))} className="w-full bg-gray-900/70 text-white px-2 py-1.5 rounded-lg border border-white/10 text-xs outline-none"/>
              : <select value={draft[f.key]} onChange={e=>setDraft(d=>({...d,[f.key]:e.target.value}))} className="w-full bg-gray-900/70 text-white px-2 py-1.5 rounded-lg border border-white/10 text-xs outline-none">
                  {f.opts.map(o=><option key={o}>{o}</option>)}
                </select>
            }
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className={`bg-gray-800/50 border border-slate-700/20 border-l-4 ${DIFF_BORDER[q.difficulty]||DIFF_BORDER.medium} rounded-xl overflow-hidden group`}>
      <div className="p-4">
        <p className="text-white text-sm font-semibold mb-3 leading-snug">
          <span className="text-gray-500 text-xs mr-2">Q{index+1}.</span>{q.text}
        </p>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {q.options.map(opt=>(
            <div key={opt.id} className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
              opt.id===q.answer
                ? "bg-green-900/40 border-green-600/60 text-green-200 font-medium"
                : "bg-gray-700/40 border-slate-700/20 text-gray-300"
            }`}>
              <span className="font-bold mr-2 text-xs">{opt.id}.</span>
              {opt.text || <span className="italic text-gray-500 text-xs">empty</span>}
              {opt.id===q.answer && <span className="ml-1.5 text-green-400">✓</span>}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${DIFF_BADGE[q.difficulty]||DIFF_BADGE.medium}`}>{q.difficulty}</span>
          <span className="text-gray-500 text-xs">{q.marks} mark{q.marks!==1?"s":""}</span>
          <span className="ml-auto text-xs font-mono bg-green-900/20 text-green-400 px-2 py-0.5 rounded">✓ {q.answer}</span>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={()=>{ setDraft(q); setEditing(true); }} className="px-2 py-1 bg-blue-900/50 hover:bg-blue-800 rounded text-xs">✏️</button>
            <button onClick={()=>{ if(confirm("Remove?")) onDelete(q.id); }} className="px-2 py-1 bg-red-900/50 hover:bg-red-800 rounded text-xs">🗑</button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────────
   LOADING OVERLAY
───────────────────────────────────────────────────────────────── */
const LoadingOverlay = ({ fileName }) => (
  <div className="fixed inset-0 z-50 bg-gray-900/80 backdrop-blur-md flex items-center justify-center p-4">
    <div className="bg-gray-800 border border-slate-700/30 rounded-3xl p-10 max-w-sm w-full text-center shadow-2xl">
      <div className="text-6xl mb-5">🤖</div>
      <h3 className="text-white font-bold text-lg mb-2">Extracting with AI…</h3>
      <p className="text-gray-400 text-sm mb-5 truncate">{fileName}</p>
      <p className="text-purple-300 text-xs mb-4">Claude is reading and extracting questions</p>
      <div className="flex justify-center gap-1.5">
        {[0,1,2].map(i=>(
          <div key={i} className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{animationDelay:`${i*0.15}s`}}/>
        ))}
      </div>
    </div>
  </div>
);

/* ─────────────────────────────────────────────────────────────────
   UPLOAD PHASE (main.png look)
───────────────────────────────────────────────────────────────── */
const UploadPhase = ({ onFile, parsing }) => {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const ACCEPTED = [".txt",".csv",".xlsx",".xls",".docx",".pdf",".png",".jpg",".jpeg"];

  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-full px-6 py-8 max-w-4xl mx-auto w-full">
      {/* Header card */}
      <div className="w-full bg-gradient-to-br from-blue-900/50 to-purple-900/30 border border-blue-800/40 rounded-3xl p-8 mb-8 flex flex-col sm:flex-row items-start sm:items-center gap-5">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-3xl shrink-0 shadow-xl shadow-blue-900/50">
          ⬆️
        </div>
        <div className="flex-1">
          <h1 className="text-white font-extrabold text-2xl mb-1">Import Question Paper</h1>
          <p className="text-blue-300 text-sm font-medium mb-2">TXT · CSV · XLSX · DOCX · PDF · PNG · JPG</p>
          <p className="text-gray-400 text-sm leading-relaxed">
            Questions are parsed <span className="text-blue-300 font-semibold">entirely in your browser</span> — no data leaves your device until you click Save. Review and edit each question before confirming.
          </p>
        </div>
      </div>

      {/* Drop Zone */}
      <div
        role="button" tabIndex={0}
        aria-label="Upload question file by clicking or dragging"
        onClick={() => !parsing && inputRef.current?.click()}
        onKeyDown={e => e.key==="Enter" && inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`w-full flex flex-col items-center justify-center gap-5 rounded-3xl border-2 border-dashed
          py-16 px-8 text-center cursor-pointer transition-all duration-300 mb-8 relative overflow-hidden
          ${dragging
            ? "border-blue-400 bg-blue-900/20 shadow-[0_0_50px_rgba(59,130,246,0.3)]"
            : "border-slate-600/50 bg-gray-800/30 hover:border-blue-500/60 hover:bg-blue-900/10 hover:shadow-[0_0_30px_rgba(59,130,246,0.15)]"
          }`}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 pointer-events-none opacity-0 hover:opacity-100 transition-opacity duration-300"/>
        <input ref={inputRef} type="file" className="hidden"
          accept={ACCEPTED.join(",")} onChange={e=>{ const f=e.target.files?.[0]; if(f)onFile(f); e.target.value=""; }}/>
        <div className={`text-8xl transition-transform duration-300 ${dragging ? "scale-125 rotate-6" : "hover:scale-110"}`}>
          📂
        </div>
        <div>
          <p className="text-white font-extrabold text-2xl mb-2">
            {dragging ? "Release to upload" : "Drag & drop your file here"}
          </p>
          <p className="text-gray-400 text-base">or click anywhere to browse</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2.5 mt-2">
          {[".txt",".csv",".xlsx",".docx",".pdf",".png",".jpg"].map(ext=>(
            <span key={ext} className="px-3 py-1.5 bg-blue-900/50 border border-blue-800/60 rounded-xl text-blue-300 text-sm font-mono font-semibold">
              {ext}
            </span>
          ))}
        </div>
      </div>

      {/* Format cards grid */}
      <div className="w-full">
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-4">Supported Formats</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {FORMAT_CARDS.map(f=>(
            <div key={f.ext} className={`rounded-2xl border p-4 flex flex-col gap-3 ${f.color}`}>
              <div className="flex items-center gap-3">
                <span className={`w-10 h-10 rounded-xl ${f.iconBg} flex items-center justify-center text-xl shrink-0`}>{f.icon}</span>
                <span className={`font-extrabold text-base ${f.textColor}`}>{f.ext}</span>
              </div>
              <p className="text-gray-300 text-xs leading-relaxed">{f.desc}</p>
              <div className="bg-black/40 rounded-xl p-3 border border-white/5 mt-auto">
                <pre className="text-green-300 text-[10px] whitespace-pre-wrap font-mono leading-relaxed break-all">{f.example}</pre>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────────
   REVIEW PHASE (add.png look)
───────────────────────────────────────────────────────────────── */
const ReviewPhase = ({ questions, updateQuestion, deleteQuestion, onSave, onCancel, saving }) => {
  const [paperTitle, setPaperTitle] = useState("");

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Sticky top bar */}
      <div className="shrink-0 bg-gray-900/95 border-b border-slate-700/20 backdrop-blur-md">
        {/* Title + Save */}
        <div className="flex flex-col sm:flex-row gap-3 px-5 py-4">
          <div className="flex-1">
            <label className="text-xs text-gray-400 font-semibold block mb-1.5">
              Paper Title <span className="text-red-400">*</span>
            </label>
            <input
              value={paperTitle}
              onChange={e=>setPaperTitle(e.target.value)}
              placeholder="e.g. Mid-Term 2025 – Physics Unit 2"
              className="w-full bg-gray-800/80 text-white px-4 py-2.5 rounded-xl outline-none border border-white/10 focus:border-blue-500 text-sm"
              onKeyDown={e=>e.key==="Enter"&&onSave(paperTitle)}
            />
          </div>
          <div className="flex gap-2 items-end shrink-0">
            <button
              onClick={onCancel}
              className="px-5 py-2.5 bg-white/8 hover:bg-white/14 border border-white/10 rounded-xl text-sm font-semibold transition-all"
            >
              ✕ Cancel
            </button>
            <button
              onClick={()=>onSave(paperTitle)}
              disabled={saving || !paperTitle.trim()}
              className="px-7 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-900/40"
            >
              {saving ? "⏳ Saving…" : `💾 Save ${questions.length} Questions to Question Bank`}
            </button>
          </div>
        </div>
        {/* Summary bar */}
        <SummaryBar questions={questions}/>
      </div>

      {/* Scrollable question list */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {questions.map((q,i)=>(
          <QuestionCard key={q.id} q={q} index={i} onUpdate={updateQuestion} onDelete={deleteQuestion}/>
        ))}
        {/* Bottom sticky save */}
        {questions.length > 5 && (
          <div className="sticky bottom-0 pt-2 pb-1">
            <button onClick={()=>onSave(paperTitle)} disabled={saving||!paperTitle.trim()}
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-2xl font-bold text-sm shadow-xl shadow-blue-900/40 transition-all">
              {saving ? "⏳ Saving…" : `💾 Save ${questions.length} Questions to Question Bank`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────────────────────────── */
const ImportPage = () => {
  const navigate = useNavigate();
  const {
    questions, parsing, error, fileName,
    parseFile, updateQuestion, deleteQuestion, reset,
  } = useQuestionParser();
  const [saving, setSaving] = useState(false);

  const phase = questions.length > 0 ? "review" : "upload";

  const handleSave = async (paperTitle) => {
    if (!paperTitle?.trim()) {
      toast.error("Please enter a paper title", { className:"custom-toast", bodyClassName:"custom-toast-body" });
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.post("/faculty/papers", {
        title: paperTitle.trim(),
        questions: questions.map(({ id: _id, ...rest }) => rest),
      });
      toast.success(`✅ "${paperTitle}" saved with ${questions.length} questions!`, {
        className:"custom-toast", bodyClassName:"custom-toast-body",
      });
      navigate("/faculty/questions", { state: { newPaperId: data.paper?.id } });
    } catch (err) {
      toast.error(err.response?.data?.message || "Save failed", {
        className:"custom-toast", bodyClassName:"custom-toast-body",
      });
    }
    setSaving(false);
  };

  const handleCancel = () => { reset(); };

  const headerActions = phase === "upload" ? (
    <button onClick={()=>navigate("/faculty/questions")}
      className="text-xs px-3 py-1.5 bg-white/8 hover:bg-white/12 rounded-lg font-medium text-gray-300 transition-colors">
      ← Back to Question Bank
    </button>
  ) : null;

  return (
    <DashboardLayout title={phase==="review" ? "Review Imported Questions" : "Import Question Paper"} actions={headerActions}>
      {/* Loading overlay (blur popup) */}
      {parsing && <LoadingOverlay fileName={fileName}/>}

      {/* Error toast-style banner */}
      {error && !parsing && (
        <div className="mb-4 bg-red-900/20 border border-red-800/40 rounded-2xl px-5 py-4 flex items-center gap-3">
          <span className="text-red-400 text-xl">⚠️</span>
          <div className="flex-1">
            <p className="text-red-300 text-sm font-semibold">Parse Error</p>
            <p className="text-red-400 text-xs mt-0.5">{error}</p>
          </div>
          <button onClick={()=>reset()} className="text-xs text-gray-500 hover:text-white px-2 py-1 rounded">✕</button>
        </div>
      )}

      {/* Phase rendering */}
      {phase === "upload" && (
        <UploadPhase onFile={parseFile} parsing={parsing}/>
      )}

      {phase === "review" && (
        <ReviewPhase
          questions={questions}
          updateQuestion={updateQuestion}
          deleteQuestion={deleteQuestion}
          onSave={handleSave}
          onCancel={handleCancel}
          saving={saving}
        />
      )}
    </DashboardLayout>
  );
};

export default ImportPage;
