// backend/utils/questionParser.js
// Multi-format question paper parser
// Returns: [{ text, options:[{id,text}], answer, marks, difficulty }]

const xlsx = require('xlsx');
const mammoth = require('mammoth');
const { Readable } = require('stream');
const csvParser = require('csv-parser');

// ── Shared finalizer ──────────────────────────────────────────────────────────
function finalizeQuestion(q) {
  const ids = ['A', 'B', 'C', 'D'];
  if (!q.options || q.options.length === 0) {
    q.options = ids.map(id => ({ id, text: '' }));
  } else {
    ids.forEach(id => {
      if (!q.options.find(o => o.id === id)) q.options.push({ id, text: '' });
    });
    q.options.sort((a, b) => a.id.localeCompare(b.id));
  }
  q.options = q.options.slice(0, 4);
  if (!['A', 'B', 'C', 'D'].includes(q.answer)) q.answer = 'A';
  q.marks = Number(q.marks) || 1;
  q.difficulty = q.difficulty || 'medium';
  q.text = (q.text || '').trim();
  return q;
}

// ── STRATEGY 1: Line-by-line parsing ─────────────────────────────────────────
// Handles well-formatted PDFs/DOCX where each element is on its own line:
//   Q1. Question text
//   A. Option A
//   B. Option B
//   Answer: B   Marks: 2
function strategyLineByLine(lines) {
  const questions = [];
  let current = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    // Question: "Q1.", "1.", "Q.1", "1)", "Question 1:"
    const qm = line.match(/^(?:Q(?:uestion)?\.?\s*)?(\d{1,3})[.):]?\s+(.+)/i);
    if (qm && qm[2].length > 3) {
      if (current) questions.push(finalizeQuestion(current));
      current = { text: qm[2].trim(), options: [], answer: 'A', marks: 1, difficulty: 'medium' };
      continue;
    }

    if (!current) continue;

    // Option: "A. text", "a) text", "(A) text", "A: text"
    const om = line.match(/^\(?([A-Da-d])\)?[.):\s]\s*(.+)/);
    if (om && om[2].trim().length > 0) {
      current.options.push({ id: om[1].toUpperCase(), text: om[2].trim() });
      continue;
    }

    // Combined "Answer: B  Marks: 2" on one line
    const combi = line.match(/answer\s*[:\-]\s*([A-Da-d])[\s,;|]+marks?\s*[:\-]\s*(\d+)/i);
    if (combi) {
      current.answer = combi[1].toUpperCase();
      current.marks  = parseInt(combi[2], 10) || 1;
      continue;
    }

    // Answer alone: "Answer: B" / "Ans: B" / "Correct: B"
    const am = line.match(/^(?:answer|ans(?:wer)?|correct(?:\s+answer)?)\s*[:\-]\s*([A-Da-d])/i);
    if (am) { current.answer = am[1].toUpperCase(); continue; }

    // Marks alone: "Marks: 2"
    const mm = line.match(/^marks?\s*[:\-]\s*(\d+)/i);
    if (mm) { current.marks = parseInt(mm[1], 10) || 1; continue; }

    // Continuation of question text (before options)
    if (current.options.length === 0 && line.length > 2) {
      current.text += ' ' + line;
    }
  }

  if (current) questions.push(finalizeQuestion(current));
  return questions;
}

// ── STRATEGY 2: Inline options on same line ───────────────────────────────────
// Handles PDFs that collapse everything:
//   "Q1. Question text  A. Opt1  B. Opt2  C. Opt3  D. Opt4  Answer: C  Marks: 1"
function strategyInline(text) {
  const questions = [];

  // Split the text at each question marker
  const chunks = text.split(/(?=(?:Q(?:uestion)?\.?\s*)?\d{1,3}[.)]\s)/i).filter(c => c.trim().length > 5);

  for (const chunk of chunks) {
    const qm = chunk.match(/^(?:Q(?:uestion)?\.?\s*)?(\d{1,3})[.)]\s+([\s\S]+)/i);
    if (!qm) continue;

    const body = qm[2];

    // Extract answer & marks before stripping them
    const ansM   = body.match(/(?:answer|ans|correct)\s*[:\-]\s*([A-Da-d])/i);
    const marksM = body.match(/marks?\s*[:\-]\s*(\d+)/i);

    const cleaned = body
      .replace(/(?:answer|ans(?:wer)?|correct(?:\s+answer)?)\s*[:\-]\s*[A-Da-d]/gi, '')
      .replace(/marks?\s*[:\-]\s*\d+/gi, '')
      .replace(/\n/g, ' ');

    // Find all option markers and their positions
    const optPat = /\(?([A-Da-d])\)?[.)]\s*/g;
    const positions = [];
    let m;
    while ((m = optPat.exec(cleaned)) !== null) {
      positions.push({ id: m[1].toUpperCase(), index: m.index, end: m.index + m[0].length });
    }

    if (positions.length < 2) continue; // need at least 2 options

    const qText = cleaned.slice(0, positions[0].index).trim();
    if (!qText || qText.length < 3) continue;

    const options = positions.map((pos, i) => {
      const end = i + 1 < positions.length ? positions[i + 1].index : cleaned.length;
      return { id: pos.id, text: cleaned.slice(pos.end, end).trim() };
    });

    questions.push(finalizeQuestion({
      text: qText,
      options,
      answer: ansM ? ansM[1].toUpperCase() : 'A',
      marks:  marksM ? parseInt(marksM[1], 10) : 1,
      difficulty: 'medium',
    }));
  }
  return questions;
}

// ── STRATEGY 3: Block-split then line-by-line ─────────────────────────────────
// For PDFs separated by blank lines / page breaks
function strategyBlocks(raw) {
  const questions = [];
  const blocks = raw.split(/\n{2,}|\f/).map(b => b.trim()).filter(b => b.length > 10);
  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(l => l);
    const partial = strategyLineByLine(lines);
    if (partial.length > 0) questions.push(...partial);
  }
  return questions;
}

// ── Master text parser ────────────────────────────────────────────────────────
function parseTextContent(rawText) {
  const text = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n');

  const lines = text.split('\n').map(l => l.trim());

  let result = strategyLineByLine(lines);
  if (result.length > 0) return result;

  result = strategyInline(text);
  if (result.length > 0) return result;

  result = strategyBlocks(text);
  return result; // may be empty → controller will send 422
}

// ── PDF parser ────────────────────────────────────────────────────────────────
async function parsePDF(buffer) {
  let pdfParse;
  try {
    // Lazy require — avoids pdf-parse reading test files at startup
    const mod = require('pdf-parse');
    // pdf-parse may export the function directly OR via .default (ESM interop)
    pdfParse = typeof mod === 'function' ? mod : (mod.default || mod);
    if (typeof pdfParse !== 'function') {
      throw new Error('pdf-parse did not export a callable function');
    }
  } catch (e) {
    throw new Error('pdf-parse module not available: ' + e.message);
  }

  let data;
  try {
    data = await pdfParse(buffer);
  } catch (e) {
    throw new Error(
      'Could not read PDF. Make sure it is a valid text-based (not scanned) PDF. Detail: ' + e.message
    );
  }

  if (!data || !data.text || data.text.trim().length === 0) {
    throw new Error(
      'The PDF has no extractable text. It may be a scanned image. ' +
      'Please use a text-based PDF, or convert to DOCX / CSV instead.'
    );
  }

  console.log(`[PDF] Pages: ${data.numpages} | Text length: ${data.text.length}`);
  // Uncomment to debug raw PDF text in the backend terminal:
  // console.log('[PDF RAW]\n', data.text.slice(0, 3000));

  return parseTextContent(data.text);
}

// ── DOCX parser ───────────────────────────────────────────────────────────────
async function parseDOCX(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  if (!result.value || result.value.trim().length === 0) {
    throw new Error('No text could be extracted from the DOCX file.');
  }
  return parseTextContent(result.value);
}

// ── Excel (XLSX / XLS) parser ─────────────────────────────────────────────────
// Expected columns (case-insensitive): Question | A | B | C | D | Answer | Marks
function parseExcel(buffer) {
  const wb = xlsx.read(buffer, { type: 'buffer' });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

  return rows
    .filter(row => {
      const q = row['Question'] || row['question'] || row['QUESTION'] || '';
      return String(q).trim().length > 0;
    })
    .map(row => {
      const get = (...keys) => {
        for (const k of keys) {
          if (row[k] !== undefined && String(row[k]).trim() !== '') return String(row[k]).trim();
        }
        return '';
      };

      const optA    = get('A', 'a', 'Option A', 'option_a', 'OptionA');
      const optB    = get('B', 'b', 'Option B', 'option_b', 'OptionB');
      const optC    = get('C', 'c', 'Option C', 'option_c', 'OptionC');
      const optD    = get('D', 'd', 'Option D', 'option_d', 'OptionD');
      const rawAns  = get('Answer', 'answer', 'ANSWER', 'Correct', 'correct', 'Ans', 'ans');
      const answer  = rawAns.toUpperCase().charAt(0) || 'A';
      const marks   = parseInt(get('Marks', 'marks', 'MARKS', 'Mark', 'mark'), 10) || 1;
      const qText   = get('Question', 'question', 'QUESTION', 'Q', 'Text', 'text');

      return finalizeQuestion({
        text: qText,
        options: [
          { id: 'A', text: optA },
          { id: 'B', text: optB },
          { id: 'C', text: optC },
          { id: 'D', text: optD },
        ],
        answer: ['A', 'B', 'C', 'D'].includes(answer) ? answer : 'A',
        marks,
        difficulty: 'medium',
      });
    });
}

// ── CSV parser ────────────────────────────────────────────────────────────────
// Headers: question, A, B, C, D, answer, marks
function parseCSV(buffer) {
  return new Promise((resolve, reject) => {
    const results = [];
    const stream = Readable.from(buffer.toString('utf-8'));
    stream
      .pipe(csvParser({
        mapHeaders: ({ header }) => header.trim().toLowerCase().replace(/\s+/g, '_'),
      }))
      .on('data', row => {
        const q = (row['question'] || row['q'] || '').trim();
        if (!q) return;

        const optA  = (row['a'] || row['option_a'] || '').trim();
        const optB  = (row['b'] || row['option_b'] || '').trim();
        const optC  = (row['c'] || row['option_c'] || '').trim();
        const optD  = (row['d'] || row['option_d'] || '').trim();
        const ans   = (row['answer'] || row['correct'] || row['ans'] || 'A')
          .trim().toUpperCase().charAt(0);
        const marks = parseInt(row['marks'] || row['mark'] || '1', 10) || 1;

        results.push(finalizeQuestion({
          text: q,
          options: [
            { id: 'A', text: optA },
            { id: 'B', text: optB },
            { id: 'C', text: optC },
            { id: 'D', text: optD },
          ],
          answer: ['A', 'B', 'C', 'D'].includes(ans) ? ans : 'A',
          marks,
          difficulty: 'medium',
        }));
      })
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

// ── Main entry point ──────────────────────────────────────────────────────────
async function parseFile(buffer, mimetype, originalname) {
  const name = (originalname || '').toLowerCase();

  if (mimetype === 'application/pdf' || name.endsWith('.pdf')) {
    return parsePDF(buffer);
  }

  if (
    mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimetype === 'application/vnd.ms-excel' ||
    name.endsWith('.xlsx') ||
    name.endsWith('.xls')
  ) {
    return parseExcel(buffer);
  }

  if (
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimetype === 'application/msword' ||
    name.endsWith('.docx') ||
    name.endsWith('.doc')
  ) {
    return parseDOCX(buffer);
  }

  if (mimetype === 'text/csv' || mimetype === 'application/csv' || name.endsWith('.csv')) {
    return parseCSV(buffer);
  }

  throw new Error('Unsupported file format. Please upload PDF, XLSX, XLS, DOCX, DOC, or CSV.');
}

module.exports = { parseFile };
