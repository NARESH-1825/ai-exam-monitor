// backend/controllers/facultyController.js - Firebase Firestore version
const { getDB } = require('../config/firebase');

const getIO = () => { try { return require('../server').io; } catch { return null; } };

exports.getStudents = async (req, res) => {
  try {
    const db = getDB();
    const snap = await db.collection('users').where('role', '==', 'student').get();
    const students = snap.docs.map(d => {
      const { password: _, activeSessionId: __, activeDeviceFingerprint: ___, ...safe } = d.data();
      return { id: d.id, ...safe };
    });
    students.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    res.json({ students });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getStudentDetail = async (req, res) => {
  try {
    const db = getDB();
    const userDoc = await db.collection('users').doc(req.params.id).get();
    if (!userDoc.exists) return res.status(404).json({ message: 'Student not found' });
    const { password: _, activeSessionId: __, activeDeviceFingerprint: ___, ...safe } = userDoc.data();

    const subsSnap = await db.collection('submissions')
      .where('student', '==', req.params.id)
      .get();

    // Deduplicate by exam — keep latest per exam
    const byExam = {};
    subsSnap.docs.forEach(d => {
      const sub = { id: d.id, ...d.data() };
      const examId = typeof sub.exam === 'string' ? sub.exam : (sub.exam?.id || '');
      if (!byExam[examId] || (sub.createdAt || '') > (byExam[examId].createdAt || '')) {
        byExam[examId] = sub;
      }
    });

    const submissions = await Promise.all(Object.values(byExam).map(async sub => {
      const examId = typeof sub.exam === 'string' ? sub.exam : (sub.exam?.id || '');
      if (examId) {
        const examDoc = await db.collection('exams').doc(examId).get();
        if (examDoc.exists) {
          const e = examDoc.data();
          const totalMarks = (e.questions || []).reduce((s, q) => s + (q.marks || 1), 0);
          sub.exam = {
            id: examDoc.id,
            title: e.title,
            duration: e.duration,
            passingScore: e.passingScore,
            totalMarks,
            questionCount: (e.questions || []).length,
          };
        }
      }
      // Fetch violation events from proctoring log.
      // violationCount is also stored on the submission doc itself — use whichever is higher.
      const submissionViolationCount = sub.violationCount || 0;
      try {
        const logSnap = await db.collection('proctoringLogs')
          .where('submissionId', '==', sub.id)
          .limit(1).get();
        if (!logSnap.empty) {
          const log = logSnap.docs[0].data();
          sub.violationEvents = log.events || [];
          // Use the highest count across: log.violationCount, log.events.length, submission.violationCount
          sub.violationCount = Math.max(
            log.violationCount || 0,
            sub.violationEvents.length,
            submissionViolationCount
          );
        } else {
          // No log doc — fall back to the count already on the submission document
          sub.violationEvents = [];
          sub.violationCount  = submissionViolationCount;
        }
      } catch (_) {
        sub.violationEvents = [];
        sub.violationCount  = submissionViolationCount;
      }
      return sub;
    }));

    submissions.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    res.json({ student: { id: userDoc.id, ...safe }, submissions });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Block student account — immediately kicks from exam and prevents login
exports.blockStudent = async (req, res) => {
  try {
    const db = getDB();
    const { studentId } = req.params;
    const now = new Date().toISOString();

    const userDoc = await db.collection('users').doc(studentId).get();
    if (!userDoc.exists) return res.status(404).json({ message: 'Student not found' });

    await db.collection('users').doc(studentId).update({
      isBlocked: true,
      blockedReason: req.body.reason || 'Blocked by faculty',
      activeSessionId: null, // invalidate session so they can't make API calls
      updatedAt: now,
    });

    // Emit socket event to force-logout this student on all active pages
    const io = getIO();
    io?.emit('user:blocked', {
      studentId,
      message: 'Your account has been blocked by faculty. You are being logged out.',
    });

    res.json({ message: 'Student blocked successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Unblock student account
exports.unblockStudent = async (req, res) => {
  try {
    const db = getDB();
    const { studentId } = req.params;

    await db.collection('users').doc(studentId).update({
      isBlocked: false,
      blockedReason: '',
      updatedAt: new Date().toISOString(),
    });

    res.json({ message: 'Student unblocked successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get exam results leaderboard for completed exam
exports.getExamResults = async (req, res) => {
  try {
    const db = getDB();
    const { examId } = req.params;

    const examDoc = await db.collection('exams').doc(examId).get();
    if (!examDoc.exists) return res.status(404).json({ message: 'Exam not found' });
    const exam = { id: examDoc.id, ...examDoc.data() };
    const totalMarks = (exam.questions || []).reduce((s, q) => s + (q.marks || 1), 0);

    const subsSnap = await db.collection('submissions')
      .where('exam', '==', examId)
      .where('status', '==', 'submitted')
      .get();

    // ── Deduplicate: one row per student ─────────────────────────────────────
    // When faculty ends exam, ongoing submissions get auto-submitted but student
    // may have already submitted manually — keep the manual one (higher score or earlier)
    const byStudent = {};
    subsSnap.docs.forEach(d => {
      const sub = { id: d.id, ...d.data() };
      const sid = sub.student;
      if (!byStudent[sid]) {
        byStudent[sid] = sub;
      } else {
        const prev = byStudent[sid];
        // Prefer: manual over auto-submitted, then higher score, then earlier submittedAt
        const prevIsManual = !prev.autoSubmitted;
        const newIsManual = !sub.autoSubmitted;
        if (newIsManual && !prevIsManual) {
          byStudent[sid] = sub; // prefer manual
        } else if (prevIsManual && !newIsManual) {
          // keep prev
        } else {
          // both same type — keep the earlier-submitted one (student's actual attempt)
          const prevTime = new Date(prev.submittedAt || prev.createdAt || 0).getTime();
          const newTime = new Date(sub.submittedAt || sub.createdAt || 0).getTime();
          if (newTime < prevTime) byStudent[sid] = sub;
        }
      }
    });

    const submissions = await Promise.all(Object.values(byStudent).map(async sub => {
      // Fetch student info
      try {
        const stuDoc = await db.collection('users').doc(sub.student).get();
        if (stuDoc.exists) {
          const { password: _, activeSessionId: __, ...safe } = stuDoc.data();
          sub.studentInfo = { id: stuDoc.id, ...safe };
        }
      } catch (_) {}

      // Fetch violation events
      try {
        const logSnap = await db.collection('proctoringLogs')
          .where('submissionId', '==', sub.id)
          .limit(1).get();
        if (!logSnap.empty) {
          const log = logSnap.docs[0].data();
          sub.violationEvents = log.events || []; sub.violationCount = Math.max(log.violationCount || 0, sub.violationCount || 0);
          
        } else {
          sub.violationEvents = [];
        }
      } catch (_) { sub.violationEvents = []; }

      sub.totalMarks = totalMarks;
      return sub;
    }));

    // Sort by score descending (leaderboard)
    submissions.sort((a, b) => (b.percentage || 0) - (a.percentage || 0));
    submissions.forEach((s, i) => { s.rank = i + 1; });

    res.json({ exam, submissions, totalMarks });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getQuestions = async (req, res) => {
  try {
    const db = getDB();
    const snap = await db.collection('questions').where('faculty', '==', req.user.userId).get();
    const questions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    questions.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    res.json({ questions });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createQuestion = async (req, res) => {
  try {
    const db = getDB();
    const now = new Date().toISOString();
    const data = { ...req.body, faculty: req.user.userId, createdAt: now, updatedAt: now };
    const ref = await db.collection('questions').add(data);
    res.status(201).json({ question: { id: ref.id, ...data } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateQuestion = async (req, res) => {
  try {
    const db = getDB();
    const ref = db.collection('questions').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists || doc.data().faculty !== req.user.userId)
      return res.status(404).json({ message: 'Question not found' });
    const updated = { ...req.body, updatedAt: new Date().toISOString() };
    await ref.update(updated);
    res.json({ question: { id: doc.id, ...doc.data(), ...updated } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteQuestion = async (req, res) => {
  try {
    const db = getDB();
    const ref = db.collection('questions').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists || doc.data().faculty !== req.user.userId)
      return res.status(404).json({ message: 'Question not found' });
    await ref.delete();
    res.json({ message: 'Question deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Question Papers ──────────────────────────────────────────────────────────

exports.getPapers = async (req, res) => {
  try {
    const db = getDB();
    const snap = await db.collection('questionPapers')
      .where('facultyId', '==', req.user.userId).get();
    const papers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    papers.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    res.json({ papers });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createPaper = async (req, res) => {
  try {
    const db = getDB();
    const userDoc = await db.collection('users').doc(req.user.userId).get();
    const facultyName = userDoc.exists ? userDoc.data().name : 'Faculty';
    const now = new Date().toISOString();
    const data = {
      title: req.body.title,
      questions: req.body.questions || [],
      facultyId: req.user.userId,
      createdBy: facultyName,
      createdAt: now,
      updatedAt: now,
      updatedBy: facultyName,
    };
    const ref = await db.collection('questionPapers').add(data);
    res.status(201).json({ paper: { id: ref.id, ...data } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updatePaper = async (req, res) => {
  try {
    const db = getDB();
    const ref = db.collection('questionPapers').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists || doc.data().facultyId !== req.user.userId)
      return res.status(404).json({ message: 'Paper not found' });
    const userDoc = await db.collection('users').doc(req.user.userId).get();
    const facultyName = userDoc.exists ? userDoc.data().name : 'Faculty';
    const now = new Date().toISOString();
    const updated = {
      title: req.body.title,
      questions: req.body.questions || [],
      updatedAt: now,
      updatedBy: facultyName,
    };
    await ref.update(updated);
    res.json({ paper: { id: doc.id, ...doc.data(), ...updated } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deletePaper = async (req, res) => {
  try {
    const db = getDB();
    const ref = db.collection('questionPapers').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists || doc.data().facultyId !== req.user.userId)
      return res.status(404).json({ message: 'Paper not found' });
    await ref.delete();
    res.json({ message: 'Paper deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Import Questions from PDF / Image / DOCX ──────────────────────────────────

/**
 * MCQ parser — LINE-BY-LINE STATE MACHINE
 * Fixes: last question skip, inline options, OCR noise
 *
 * Accepted question headers: Q1.  Q1)  1.  1)  Question 1.
 * Accepted option headers:   A.  a)  (A)  A:  a-
 * Accepted answer lines:     Answer: B  Ans: B  Correct: B  Key: B  checkmark B
 */
function parseMCQText(rawText) {
  const lines = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\f/g, '\n')
    .split('\n');

  const Q_RE   = /^(?:Q(?:uestion)?\s*\d+\s*[\.\):\-]\s*|\d+\s*[\.\):\-]\s*)/i;
  const OPT_RE = /^\s*(?:\(([A-Da-d])\)|([A-Da-d])\s*[\.\)\-:])\s*(.+)/;
  const ANS_RE = /(?:correct\s+answer|correct|answer|ans|key|sol(?:ution)?)\s*[:\-\u2013=]\s*([A-D])/i;
  const DIFF_RE= /(?:difficulty|diff|level)\s*[:\-\u2013=]\s*(easy|medium|hard)/i;
  const MRK_RE = /(?:marks?\s*[:\-\u2013=]|points?\s*[:\-\u2013=])\s*(\d+)/i;
  const TICK_RE= /[\u2713\u2714]\s*([A-D])/;

  const questions = [];

  function flush(q) {
    if (!q) return;
    const hasOpts = q.opts.A || q.opts.B || q.opts.C || q.opts.D;
    if (!hasOpts || !q.text) return;
    if (!['A','B','C','D'].includes(q.answer)) q.answer = 'A';
    questions.push({
      id: `imp_${Date.now()}_${questions.length}_${Math.random().toString(36).slice(2,7)}`,
      text: q.text,
      options: ['A','B','C','D'].map(id => ({ id, text: q.opts[id] || '' })),
      answer: q.answer,
      marks: q.marks,
      difficulty: q.difficulty,
    });
  }

  let cur = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    // New question header
    if (Q_RE.test(line)) {
      flush(cur);
      const qText = line.replace(Q_RE, '').trim();
      cur = { text: qText, opts: { A:'', B:'', C:'', D:'' }, answer: '', marks: 1, difficulty: 'medium' };

      // Detect inline options on same line: "What is X? A) foo B) bar C) baz D) qux"
      const firstOptPos = qText.search(/\b[A-Da-d]\s*[\.\)\-:]/);
      if (firstOptPos > 5) {
        const inlineOpts = [...qText.matchAll(/\b([A-Da-d])\s*[\.\)\-:]\s*(.+?)(?=\s+\b[A-Da-d]\s*[\.\)\-:]|$)/gi)];
        if (inlineOpts.length >= 2) {
          cur.text = qText.slice(0, firstOptPos).trim();
          for (const m of inlineOpts) {
            const id = m[1].toUpperCase();
            if (['A','B','C','D'].includes(id)) cur.opts[id] = m[2].trim();
          }
        }
      }
      continue;
    }

    if (!cur) continue;

    // Option line
    const optM = line.match(OPT_RE);
    if (optM) {
      const id  = (optM[1] || optM[2]).toUpperCase();
      let   val = optM[3].trim();
      const hasTick = /[\u2713\u2714]/.test(val) || /\(correct\)/i.test(val);
      val = val.replace(/[\u2713\u2714]/g,'').replace(/\(correct\)/gi,'').trim();
      if (['A','B','C','D'].includes(id)) {
        cur.opts[id] = val;
        if (hasTick && !cur.answer) cur.answer = id;
      }
      continue;
    }

    // Answer line
    const ansM = line.match(ANS_RE);
    if (ansM) { cur.answer = ansM[1].toUpperCase(); continue; }

    // Tick-only answer
    const tickM = line.match(TICK_RE);
    if (tickM && !cur.answer) { cur.answer = tickM[1].toUpperCase(); continue; }

    // Difficulty
    const diffM = line.match(DIFF_RE);
    if (diffM) { cur.difficulty = diffM[1].toLowerCase(); continue; }

    // Marks
    const mrkM = line.match(MRK_RE);
    if (mrkM) { cur.marks = Math.max(1, parseInt(mrkM[1], 10) || 1); continue; }

    // Multi-line question text continuation (only if no options collected yet)
    const noOpts = !cur.opts.A && !cur.opts.B && !cur.opts.C && !cur.opts.D;
    if (noOpts && !/^(page|section|part|www\.|http|\d+\s*\/\s*\d+)/i.test(line)) {
      cur.text += ' ' + line;
    }
  }

  flush(cur); // flush the LAST question — this was the bug
  return questions;
}

/** Extract text from DOCX buffer */
async function extractDocxText(buffer) {
  const mammoth = require('mammoth');
  const result  = await mammoth.extractRawText({ buffer });
  return result.value || '';
}

/** OCR an image/PDF buffer using tesseract.js */
async function ocrBuffer(buffer) {
  const { createWorker } = require('tesseract.js');
  const worker = await createWorker('eng');
  try {
    const { data } = await worker.recognize(buffer);
    return data.text || '';
  } finally {
    await worker.terminate();
  }
}

// ── Import Questions from PDF / Image / DOCX ─────────────────────────────────
exports.importQuestionsFromFile = async (req, res) => {
  try {
    const { fileBase64, mediaType, fileName } = req.body;
    if (!fileBase64 || !mediaType) {
      return res.status(400).json({ message: 'fileBase64 and mediaType are required' });
    }

    const buffer = Buffer.from(fileBase64, 'base64');
    const ext    = (fileName || '').split('.').pop().toLowerCase();
    let rawText  = '';

    // DOCX / DOC
    if (ext === 'docx' || ext === 'doc' ||
        mediaType.includes('wordprocessingml') || mediaType.includes('msword')) {
      try {
        rawText = await extractDocxText(buffer);
      } catch (e) {
        return res.status(422).json({ message: 'Could not read this Word document. Please save as .docx and try again.' });
      }

    // PDF — text extraction via pdf-parse (digital PDFs only)
    } else if (mediaType === 'application/pdf') {
      const pdfParse = require('pdf-parse');
      try {
        const data = await pdfParse(buffer);
        rawText = data.text || '';
      } catch (pdfErr) {
        console.warn('[import] pdf-parse failed:', pdfErr.message);
        // NOTE: tesseract.js cannot read raw PDF bytes — it only handles images.
        // Tell the user to convert the PDF page to an image instead.
        return res.status(422).json({
          message:
            'This PDF could not be read (it may be corrupt or use an unsupported format). ' +
            'Please take a screenshot of the PDF page and upload it as a PNG or JPG image instead.',
        });
      }

      // pdf-parse succeeded but got no text (e.g. scanned/image-only PDF)
      if (!rawText.trim()) {
        return res.status(422).json({
          message:
            'This PDF appears to be a scanned/image-only PDF — no text could be extracted. ' +
            'Please take a screenshot of the page and upload it as a PNG or JPG image instead.',
        });
      }

    // Image → OCR
    } else {
      try { rawText = await ocrBuffer(buffer); } catch (e) {
        return res.status(422).json({ message: 'OCR failed. Use a clear printed image (PNG/JPG).' });
      }
    }

    if (!rawText || !rawText.trim()) {
      return res.status(422).json({
        message: 'No readable text found in file. ' +
          (mediaType === 'application/pdf'
            ? 'PDF may be password-protected. Try a PNG/JPG screenshot instead.'
            : 'For images, use a clear high-contrast scan with printed text.'),
      });
    }

    console.log('[import] Extracted text preview:\n', rawText.slice(0, 500));

    const questions = parseMCQText(rawText);

    if (questions.length === 0) {
      return res.status(422).json({
        message:
          'Text was extracted but no MCQ questions detected.\n' +
          'Expected format:\n  Q1. Question text\n  A) option\n  B) option\n  Answer: A\n\n' +
          'Extracted text preview:\n' + rawText.slice(0, 600),
      });
    }


    res.json({ questions, count: questions.length });
  } catch (err) {
    console.error('importQuestionsFromFile error:', err);
    res.status(500).json({ message: err.message || 'Import failed' });
  }
};

