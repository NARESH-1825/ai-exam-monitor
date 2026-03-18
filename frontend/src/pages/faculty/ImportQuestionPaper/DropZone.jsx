// src/pages/faculty/ImportQuestionPaper/DropZone.jsx
import { useState, useRef } from "react";

const ACCEPTED = [".txt", ".csv", ".xlsx", ".xls", ".docx", ".pdf", ".png", ".jpg", ".jpeg"];

const FORMAT_CARDS = [
  {
    ext: "TXT",
    icon: "📄",
    color: "border-blue-700/40 bg-blue-900/20",
    iconBg: "bg-blue-800/50",
    textColor: "text-blue-300",
    desc: "Plain text with Q/A blocks separated by blank lines.",
    example: `Q1. What is 2+2?\nA) 3\nB) 4\nC) 5\nD) 6\nAnswer: B\nDifficulty: easy\nMarks: 1`,
  },
  {
    ext: "CSV",
    icon: "📊",
    color: "border-green-700/40 bg-green-900/20",
    iconBg: "bg-green-800/50",
    textColor: "text-green-300",
    desc: "Columns: question, A, B, C, D, answer, difficulty, marks.",
    example: `question,A,B,C,D,answer,difficulty,marks\n"Capital?",Berlin,Madrid,Paris,Rome,C,easy,1`,
  },
  {
    ext: "XLSX",
    icon: "📗",
    color: "border-emerald-700/40 bg-emerald-900/20",
    iconBg: "bg-emerald-800/50",
    textColor: "text-emerald-300",
    desc: "Excel file — same column structure as CSV. First sheet used.",
    example: `question | A | B | C | D | answer | difficulty | marks`,
  },
  {
    ext: "DOCX",
    icon: "📝",
    color: "border-indigo-700/40 bg-indigo-900/20",
    iconBg: "bg-indigo-800/50",
    textColor: "text-indigo-300",
    desc: "Word doc — same Q/A block format as TXT, blank lines between questions.",
    example: `Q1. Largest planet?\nA) Earth  B) Mars\nC) Jupiter  D) Saturn\nAns: C`,
  },
  {
    ext: "PDF",
    icon: "📕",
    color: "border-red-700/40 bg-red-900/20",
    iconBg: "bg-red-800/50",
    textColor: "text-red-300",
    desc: "Digital PDFs are parsed directly. Scanned PDFs use OCR automatically.",
    example: `Works best with digital (text-based) PDFs.\nScanned PDFs: OCR is applied automatically.`,
  },
  {
    ext: "IMG",
    icon: "🖼️",
    color: "border-purple-700/40 bg-purple-900/20",
    iconBg: "bg-purple-800/50",
    textColor: "text-purple-300",
    desc: "PNG, JPG, JPEG — questions are extracted via OCR. Use clean printed text.",
    example: `Supported: .png .jpg .jpeg\nBest results: printed text, high contrast, clean background.`,
  },
];

const DropZone = ({ onFile, parsing, fileName, ocrProgress }) => {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  };

  const handleChange = (e) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    e.target.value = "";
  };

  const isOCR = ocrProgress > 0 && ocrProgress < 100;

  return (
    <div className="space-y-6">
      {/* ── Drop Zone ── */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload question file by clicking or dragging"
        onClick={() => !parsing && inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`relative group flex flex-col items-center justify-center gap-4
          rounded-2xl border-2 border-dashed py-12 px-8 text-center cursor-pointer
          transition-all duration-300 overflow-hidden
          ${dragging
            ? "border-blue-400 bg-blue-900/25 shadow-[0_0_40px_rgba(59,130,246,0.3)]"
            : "border-slate-600/50 bg-gray-800/40 hover:border-blue-500/70 hover:bg-blue-900/12 hover:shadow-[0_0_25px_rgba(59,130,246,0.15)]"
          }
          ${parsing ? "cursor-not-allowed opacity-70" : ""}
        `}
      >
        {/* Glow overlay */}
        <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500/8 to-purple-500/8 transition-opacity duration-300 pointer-events-none ${dragging ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`} />

        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={ACCEPTED.join(",")}
          onChange={handleChange}
          disabled={parsing}
        />

        {parsing ? (
          <div className="flex flex-col items-center gap-3 w-full">
            {isOCR ? (
              <>
                <div className="text-5xl">🔍</div>
                <p className="text-purple-300 font-semibold text-sm">Running OCR… {ocrProgress}%</p>
                <div className="w-48 h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all duration-300"
                    style={{ width: `${ocrProgress}%` }}
                  />
                </div>
                <p className="text-gray-500 text-xs">Extracting text from image/scanned PDF</p>
              </>
            ) : (
              <>
                <div className="text-5xl animate-bounce">⚙️</div>
                <p className="text-blue-300 font-semibold text-sm">Parsing {fileName}…</p>
                <p className="text-gray-500 text-xs">Extracting and structuring questions</p>
              </>
            )}
          </div>
        ) : fileName ? (
          <>
            <div className="text-5xl">✅</div>
            <div>
              <p className="text-green-400 font-semibold text-sm">{fileName}</p>
              <p className="text-gray-500 text-xs mt-1">Drop or click to replace file</p>
            </div>
          </>
        ) : (
          <>
            <div className={`text-6xl transition-transform duration-300 ${dragging ? "scale-125 rotate-6" : "group-hover:scale-110"}`}>
              📂
            </div>
            <div>
              <p className="text-white font-bold text-base mb-1">
                {dragging ? "Release to upload" : "Drag & drop your file here"}
              </p>
              <p className="text-gray-400 text-sm">or click to browse</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 mt-1">
              {["TXT", "CSV", "XLSX", "DOCX", "PDF", "PNG", "JPG"].map((ext) => (
                <span key={ext} className="px-2.5 py-1 bg-blue-900/40 border border-blue-800/50 rounded-lg text-blue-300 text-xs font-mono font-semibold">
                  .{ext.toLowerCase()}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Format Guide — always-visible row grid ── */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">
          Supported Formats
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {FORMAT_CARDS.map((f) => (
            <div
              key={f.ext}
              className={`rounded-xl border p-3 flex flex-col gap-2 ${f.color}`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-8 h-8 rounded-lg ${f.iconBg} flex items-center justify-center text-base shrink-0`}>
                  {f.icon}
                </span>
                <span className={`font-bold text-sm ${f.textColor}`}>{f.ext}</span>
              </div>
              <p className="text-gray-400 text-[11px] leading-relaxed">{f.desc}</p>
              <div className="bg-black/30 rounded-lg p-2 border border-white/5">
                <pre className="text-green-300 text-[10px] whitespace-pre-wrap font-mono leading-relaxed break-all">
                  {f.example}
                </pre>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DropZone;
