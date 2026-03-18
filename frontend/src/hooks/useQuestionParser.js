// src/hooks/useQuestionParser.js
// TXT / CSV / XLSX  →  parsed locally in the browser
// PDF / Image / DOCX / DOC  →  sent to backend (pdf-parse + tesseract.js + mammoth)
import { useState, useCallback } from "react";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import api from "../services/api";

/* ── Local parsers for simple text formats ───────────────────────── */
const ANSWER_KEYS     = /^\s*(answer|ans|correct|key|solution)\s*[:\-\s]\s*/i;
const DIFFICULTY_KEYS = /^\s*(difficulty|diff|level)\s*[:\-\s]\s*/i;
const MARKS_KEYS      = /^\s*(marks?|points?|score)\s*[:\-\s]\s*/i;

const parseTextBlock = (rawText) => {
  const blocks    = rawText.split(/\n\s*\n+/);
  const questions = [];
  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length < 3) continue;
    let qLine = lines[0].replace(/^(Q\d+[\.:\)]\s*|\d+[\.:\)]\s*)/i, "").trim();
    if (!qLine) continue;
    const options = [];
    let answer = "", difficulty = "medium", marks = 1;
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const optMatch = line.match(/^([A-Da-d])\s*[\.)\-:]\s*(.+)/);
      if (optMatch) { options.push({ id: optMatch[1].toUpperCase(), text: optMatch[2].trim() }); continue; }
      if (ANSWER_KEYS.test(line))     { answer = line.replace(ANSWER_KEYS, "").trim().toUpperCase().charAt(0); continue; }
      if (DIFFICULTY_KEYS.test(line)) {
        const raw = line.replace(DIFFICULTY_KEYS, "").trim().toLowerCase();
        if (["easy","medium","hard"].includes(raw)) difficulty = raw; continue;
      }
      if (MARKS_KEYS.test(line)) {
        const raw = parseInt(line.replace(MARKS_KEYS, "").trim(), 10);
        if (!isNaN(raw) && raw > 0) marks = raw; continue;
      }
    }
    while (options.length < 4) options.push({ id: ["A","B","C","D"][options.length], text: "" });
    if (!["A","B","C","D"].includes(answer)) answer = "A";
    questions.push({
      id: Date.now().toString() + Math.random(),
      text: qLine, options: options.slice(0, 4), answer, difficulty, marks,
    });
  }
  return questions;
};

const parseTableRows = (rows) => {
  if (!rows || rows.length < 2) return [];
  const headers = rows[0].map((h) => String(h || "").toLowerCase().trim());
  const colIdx  = (keys) => { for (const k of keys) { const i = headers.findIndex((h) => h.includes(k)); if (i !== -1) return i; } return -1; };
  const qIdx = colIdx(["question","q","text"]);
  if (qIdx === -1) return [];
  const aIdx = colIdx(["option a","opt_a"," a"]), bIdx = colIdx(["option b","opt_b"," b"]);
  const cIdx = colIdx(["option c","opt_c"," c"]), dIdx = colIdx(["option d","opt_d"," d"]);
  const ansIdx  = colIdx(["answer","ans","correct","key"]);
  const diffIdx = colIdx(["difficulty","diff","level"]);
  const marksIdx= colIdx(["marks","points","score"]);
  return rows.slice(1).filter((r) => r[qIdx]).map((row, i) => {
    const get = (idx) => idx !== -1 ? String(row[idx] || "").trim() : "";
    const rawAns = get(ansIdx).toUpperCase().charAt(0);
    const answer = ["A","B","C","D"].includes(rawAns) ? rawAns : "A";
    const diff   = get(diffIdx).toLowerCase();
    return {
      id: Date.now().toString() + i + Math.random(),
      text: get(qIdx),
      options: [
        { id:"A", text:get(aIdx) }, { id:"B", text:get(bIdx) },
        { id:"C", text:get(cIdx) }, { id:"D", text:get(dIdx) },
      ],
      answer,
      difficulty: ["easy","medium","hard"].includes(diff) ? diff : "medium",
      marks: parseInt(get(marksIdx), 10) || 1,
    };
  });
};

/* ── Send file to backend for PDF / Image / DOCX ───────────────── */
async function sendToBackend(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  const mediaType =
    ext === "pdf"  ? "application/pdf" :
    ext === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" :
    ext === "doc"  ? "application/msword" :
    ext === "jpg"  ? "image/jpeg" :
    ext === "png"  ? "image/png" :
    ext === "webp" ? "image/webp" :
    file.type || "application/octet-stream";

  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const { data } = await api.post("/faculty/import-questions", {
    fileBase64: base64,
    mediaType,
    fileName: file.name,
  });
  return data.questions || [];
}

/* ── Main hook ───────────────────────────────────────────────────── */
const useQuestionParser = () => {
  const [questions,   setQuestions]   = useState([]);
  const [parsing,     setParsing]     = useState(false);
  const [error,       setError]       = useState(null);
  const [fileName,    setFileName]    = useState(null);
  const [ocrProgress, setOcrProgress] = useState(0);

  const parseFile = useCallback(async (file) => {
    if (!file) return;
    setParsing(true);
    setError(null);
    setFileName(file.name);
    setOcrProgress(0);

    try {
      const ext = file.name.split(".").pop().toLowerCase();

      if (ext === "txt") {
        const text = await file.text();
        setQuestions(parseTextBlock(text));

      } else if (ext === "csv") {
        const text   = await file.text();
        const result = Papa.parse(text, { skipEmptyLines: true });
        setQuestions(parseTableRows(result.data));

      } else if (ext === "xlsx" || ext === "xls") {
        const buf = await file.arrayBuffer();
        const wb  = XLSX.read(buf, { type: "array" });
        const ws  = wb.Sheets[wb.SheetNames[0]];
        setQuestions(parseTableRows(XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" })));

      } else if (["pdf","docx","doc","png","jpg","jpeg","webp"].includes(ext)) {
        // All heavy lifting goes to the backend
        const imported = await sendToBackend(file);
        if (!imported || imported.length === 0) {
          setError("No MCQ questions found in this file. Ensure it follows Q1./A)/Answer: format.");
        } else {
          setQuestions(imported);
        }

      } else {
        setError("Unsupported file type. Supported: PDF, DOCX, PNG, JPG, TXT, CSV, XLSX.");
      }

    } catch (err) {
      console.error("Parser error:", err);
      const serverMsg = err.response?.data?.message;
      setError(serverMsg || "Failed to process file: " + (err.message || "Unknown error."));
    }

    setOcrProgress(0);
    setParsing(false);
  }, []);

  const updateQuestion = useCallback(
    (id, updated) => setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...updated } : q))),
    []
  );

  const deleteQuestion = useCallback(
    (id) => setQuestions((prev) => prev.filter((q) => q.id !== id)),
    []
  );

  const reset = useCallback(() => {
    setQuestions([]); setError(null); setFileName(null); setOcrProgress(0);
  }, []);

  return { questions, parsing, error, fileName, ocrProgress, parseFile, updateQuestion, deleteQuestion, reset };
};

export default useQuestionParser;
