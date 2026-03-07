// backend/controllers/examController.js
// REDESIGN: violation-count based system
//   - DB schema: submissions have violationCount (int) + cheated (bool) instead of cheatScore
//   - proctoringLogs: violationCount + events array (each event = 1 violation)
//   - 3 violations → autoSubmit with score=0, passed=false, cheated=true
const { getDB } = require('../config/firebase');
const getIO = () => { try { return require('../server').io; } catch { return null; } };

// ── Create exam ───────────────────────────────────────────────────────────────
exports.createExam = async (req, res) => {
  try {
    const db  = getDB();
    const now = new Date().toISOString();

    const data = {
      title:            req.body.title,
      description:      req.body.description || '',
      duration:         Number(req.body.duration) || 60,
      pageCloseTime:    Number(req.body.pageCloseTime) || 0,
      passingScore:     Number(req.body.passingScore) || 40,
      proctoring:       req.body.proctoring || {},       // selected proctors only
      questions:        req.body.questions || [],
      questionPaperId:  req.body.questionPaperId  || null,
      questionPaperTitle: req.body.questionPaperTitle || null,
      proctorCount:     Number(req.body.proctorCount) || 0,
      faculty:          req.user.userId,
      status:           'draft',
      createdAt: now, updatedAt: now,
    };

    const ref = await db.collection('exams').add(data);
    res.status(201).json({ exam: { ...data, id: ref.id, _id: ref.id } });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── Get all exams for faculty ─────────────────────────────────────────────────
exports.getFacultyExams = async (req, res) => {
  try {
    const db   = getDB();
    const snap = await db.collection('exams').where('faculty', '==', req.user.userId).get();
    const exams = snap.docs.map(d => ({ ...d.data(), id: d.id, _id: d.id }));
    exams.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    res.json({ exams });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── Get single exam ───────────────────────────────────────────────────────────
exports.getExam = async (req, res) => {
  try {
    const db  = getDB();
    const doc = await db.collection('exams').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ message: 'Exam not found' });
    res.json({ exam: { id: doc.id, ...doc.data() } });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── Launch exam ───────────────────────────────────────────────────────────────
exports.launchExam = async (req, res) => {
  try {
    const db  = getDB();
    const ref = db.collection('exams').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists || doc.data().faculty !== req.user.userId)
      return res.status(404).json({ message: 'Exam not found' });
    const now = new Date().toISOString();
    await ref.update({ status: 'live', startTime: now, updatedAt: now });
    const exam = { id: doc.id, ...doc.data(), status: 'live', startTime: now };
    getIO()?.to(`exam_${req.params.id}`).emit('exam:started', {
      examId: req.params.id, title: exam.title,
      duration: exam.duration, pageCloseTime: exam.pageCloseTime || 0, startTime: now,
    });
    res.json({ message: 'Exam is now LIVE', exam });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── End exam (faculty) ────────────────────────────────────────────────────────
exports.endExam = async (req, res) => {
  try {
    const db  = getDB();
    const ref = db.collection('exams').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists || doc.data().faculty !== req.user.userId)
      return res.status(404).json({ message: 'Exam not found' });
    const now      = new Date().toISOString();
    const examData = doc.data();
    await ref.update({ status: 'completed', endTime: now, updatedAt: now });

    const ongoing = await db.collection('submissions')
      .where('exam', '==', req.params.id).where('status', '==', 'ongoing').get();

    const batch = db.batch();
    for (const d of ongoing.docs) {
      const sub = d.data();
      let score = 0, totalMarks = 0;
      const graded = (examData.questions || []).map(q => {
        const qId = q._id || q.id;
        totalMarks += (q.marks || 1);
        const ans = (sub.answers || []).find(a => a.questionId === qId);
        const ok  = ans?.selectedOption === q.answer;
        if (ok) score += (q.marks || 1);
        return { questionId: qId, selectedOption: ans?.selectedOption || null, isCorrect: ok };
      });
      const pct    = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;
      const passed = pct >= (examData.passingScore || 40);
      const taken  = Math.round((Date.now() - new Date(sub.startedAt).getTime()) / 1000);
      batch.update(d.ref, {
        answers: graded, score, totalMarks, percentage: pct, passed,
        status: 'submitted', autoSubmitted: true, autoSubmitReason: 'Faculty ended exam',
        submittedAt: now, timeTaken: taken, updatedAt: now,
      });
    }
    await batch.commit();

    getIO()?.to(`exam_${req.params.id}`).emit('exam:ended', { examId: req.params.id });
    res.json({ message: 'Exam ended', exam: { id: doc.id, ...examData, status: 'completed' } });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── Get available exams (student) ─────────────────────────────────────────────
exports.getAvailableExams = async (req, res) => {
  try {
    const db   = getDB();
    const snap = await db.collection('exams').where('status', '==', 'live').get();
    const exams = await Promise.all(snap.docs.map(async d => {
      const exam = { id: d.id, ...d.data() };
      if (exam.faculty) {
        try {
          const fd = await db.collection('users').doc(exam.faculty).get();
          if (fd.exists) exam.facultyName = fd.data().name;
        } catch (_) {}
      }
      const { questions, ...safe } = exam;
      safe.questionCount = Array.isArray(questions) ? questions.length : 0;
      return safe;
    }));
    res.json({ exams });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── Start exam (student) ──────────────────────────────────────────────────────
exports.startExam = async (req, res) => {
  try {
    const db  = getDB();
    const doc = await db.collection('exams').doc(req.params.id).get();
    if (!doc.exists || doc.data().status !== 'live')
      return res.status(400).json({ message: 'Exam not available or not live' });

    const exam = doc.data();

    // Block re-attempt
    const existing = await db.collection('submissions')
      .where('exam', '==', req.params.id)
      .where('student', '==', req.user.userId)
      .limit(1).get();
    if (!existing.empty) return res.status(400).json({ message: 'Already attempted this exam' });

    // Strip answer keys
    const safeQs = (exam.questions || []).map(({ answer: _, ...q }) => ({
      ...q, _id: q._id || q.id || Math.random().toString(36).slice(2),
    }));

    const now = new Date().toISOString();

    // Create submission — violationCount replaces cheatScore
    const subRef = await db.collection('submissions').add({
      exam:             req.params.id,
      student:          req.user.userId,
      answers:          [],
      score: 0, totalMarks: 0, percentage: 0, passed: false,
      startedAt: now, submittedAt: null,
      autoSubmitted: false, autoSubmitReason: '',
      cheated:          false,          // NEW: true if auto-submitted via violations
      violationCount:   0,              // NEW: increments per violation event
      status:           'ongoing',
      timeTaken: 0,
      createdAt: now, updatedAt: now,
    });

    // Create proctoring log
    const logRef = await db.collection('proctoringLogs').add({
      submissionId:   subRef.id,
      studentId:      req.user.userId,
      examId:         req.params.id,
      events:         [],
      violationCount: 0,               // NEW: mirrors submission.violationCount
      createdAt: now,
    });

    // Notify monitor
    const io          = getIO();
    const studentDoc  = await db.collection('users').doc(req.user.userId).get();
    const studentInfo = studentDoc.exists
      ? { id: studentDoc.id, ...studentDoc.data() }
      : { id: req.user.userId };
    io?.to(`monitor_${req.params.id}`).emit('student:joined', {
      studentId: req.user.userId, submissionId: subRef.id, student: studentInfo,
    });

    res.json({
      title:          exam.title,
      description:    exam.description || '',
      submissionId:   subRef.id,
      proctoringLogId: logRef.id,
      questions:      safeQs,
      duration:       exam.duration,
      pageCloseTime:  exam.pageCloseTime || 0,
      passingScore:   exam.passingScore || 40,
      proctoring:     exam.proctoring || {},
      totalMarks:     (exam.questions || []).reduce((s, q) => s + (q.marks || 1), 0),
    });
  } catch (err) {
    console.error('startExam error:', err);
    res.status(500).json({ message: err.message });
  }
};

// ── Submit exam (student) ─────────────────────────────────────────────────────
exports.submitExam = async (req, res) => {
  try {
    const { submissionId, answers, autoSubmitted, autoSubmitReason, cheated } = req.body;
    const db = getDB();

    const subDoc = await db.collection('submissions').doc(submissionId).get();
    if (!subDoc.exists || subDoc.data().student !== req.user.userId)
      return res.status(403).json({ message: 'Unauthorized' });
    if (subDoc.data().status !== 'ongoing')
      return res.status(400).json({ message: 'Exam already submitted' });

    const sub     = subDoc.data();
    const examDoc = await db.collection('exams').doc(sub.exam).get();
    if (!examDoc.exists) return res.status(400).json({ message: 'Exam not found' });
    const exam = examDoc.data();

    let score = 0, totalMarks = 0, percentage = 0, passed = false;
    let graded = [];

    if (cheated) {
      // Cheated → 0 marks, no grading needed
      totalMarks = (exam.questions || []).reduce((s, q) => s + (q.marks || 1), 0);
      graded = (exam.questions || []).map(q => ({
        questionId: q._id || q.id, selectedOption: null, isCorrect: false,
      }));
      score = 0; percentage = 0; passed = false;
    } else {
      graded = (exam.questions || []).map(q => {
        const qId = q._id || q.id;
        totalMarks += (q.marks || 1);
        const ans = (answers || []).find(a => a.questionId === qId);
        const ok  = ans?.selectedOption === q.answer;
        if (ok) score += (q.marks || 1);
        return { questionId: qId, selectedOption: ans?.selectedOption || null, isCorrect: ok };
      });
      percentage = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;
      passed     = percentage >= (exam.passingScore || 40);
    }

    const taken = Math.round((Date.now() - new Date(sub.startedAt).getTime()) / 1000);
    const now   = new Date().toISOString();
    const vc    = subDoc.data().violationCount || 0;

    await subDoc.ref.update({
      answers: graded, score, totalMarks, percentage, passed,
      submittedAt: now, autoSubmitted: autoSubmitted || false,
      autoSubmitReason: autoSubmitReason || '',
      cheated: cheated || false,
      violationCount: vc,
      timeTaken: taken, status: 'submitted', updatedAt: now,
    });

    // Update proctoring log
    const logSnap = await db.collection('proctoringLogs')
      .where('submissionId', '==', submissionId).limit(1).get();
    if (!logSnap.empty) await logSnap.docs[0].ref.update({ violationCount: vc, updatedAt: now });

    // Notify monitor
    getIO()?.to(`monitor_${sub.exam}`).emit('student:submitted', {
      studentId: req.user.userId, submissionId,
      score, totalMarks, percentage, passed,
      autoSubmitted: autoSubmitted || false,
      autoSubmitReason: autoSubmitReason || '',
      cheated: cheated || false,
      violationCount: vc,
    });

    res.json({
      submission: {
        id: submissionId, ...sub,
        answers: graded, score, totalMarks, percentage, passed,
        submittedAt: now, timeTaken: taken, status: 'submitted',
        cheated: cheated || false, violationCount: vc,
        autoSubmitted: autoSubmitted || false,
        autoSubmitReason: autoSubmitReason || '',
      },
    });
  } catch (err) {
    console.error('submitExam error:', err);
    res.status(500).json({ message: err.message });
  }
};

// ── Get student results ───────────────────────────────────────────────────────
exports.getResults = async (req, res) => {
  try {
    const db   = getDB();
    const snap = await db.collection('submissions').where('student', '==', req.user.userId).get();

    // Deduplicate by exam
    const byExam = {};
    snap.docs.forEach(d => {
      const sub = { id: d.id, ...d.data() };
      if (!byExam[sub.exam] || (sub.createdAt || '') > (byExam[sub.exam].createdAt || ''))
        byExam[sub.exam] = sub;
    });

    const submissions = await Promise.all(Object.values(byExam).map(async sub => {
      if (sub.exam) {
        try {
          const ed = await db.collection('exams').doc(sub.exam).get();
          if (ed.exists) {
            const e = ed.data();
            sub.exam = { id: ed.id, title: e.title, duration: e.duration, passingScore: e.passingScore };
          }
        } catch (_) {}
      }
      // Attach violation events from proctoring log (for faculty view — not exposed to student)
      try {
        const ls = await db.collection('proctoringLogs')
          .where('submissionId', '==', sub.id).limit(1).get();
        if (!ls.empty) {
          const log = ls.docs[0].data();
          sub.violationEvents  = log.events || [];
          sub.violationCount   = log.violationCount || sub.violationCount || 0;
        } else {
          sub.violationEvents = [];
        }
      } catch (_) { sub.violationEvents = []; }
      return sub;
    }));

    submissions.sort((a, b) => (b.submittedAt || b.createdAt || '').localeCompare(a.submittedAt || a.createdAt || ''));
    res.json({ submissions });
  } catch (err) { res.status(500).json({ message: err.message }); }
};
