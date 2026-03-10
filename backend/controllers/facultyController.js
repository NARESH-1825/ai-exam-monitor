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

    // ── Fetch this faculty's own exam IDs first ───────────────────────────────
    const facultyExamsSnap = await db.collection('exams')
      .where('faculty', '==', req.user.userId).get();
    const facultyExamIds = new Set(facultyExamsSnap.docs.map(d => d.id));

    const subsSnap = await db.collection('submissions')
      .where('student', '==', req.params.id)
      .get();

    // ── Deduplicate by exam — keep latest per exam ────────────────────────────
    const byExam = {};
    subsSnap.docs.forEach(d => {
      const sub = { id: d.id, ...d.data() };
      const examId = typeof sub.exam === 'string' ? sub.exam : (sub.exam?.id || '');

      // FILTER: only include submissions for this faculty's exams
      if (!facultyExamIds.has(examId)) return;

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
      const submissionViolationCount = sub.violationCount || 0;
      try {
        const logSnap = await db.collection('proctoringLogs')
          .where('submissionId', '==', sub.id)
          .limit(1).get();
        if (!logSnap.empty) {
          const log = logSnap.docs[0].data();
          sub.violationEvents = log.events || [];
          sub.violationCount = Math.max(
            log.violationCount || 0,
            sub.violationEvents.length,
            submissionViolationCount
          );
        } else {
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

exports.getPaper = async (req, res) => {
  try {
    const db = getDB();
    const doc = await db.collection('questionPapers').doc(req.params.id).get();
    if (!doc.exists || doc.data().facultyId !== req.user.userId)
      return res.status(404).json({ message: 'Paper not found' });
    res.json({ paper: { id: doc.id, ...doc.data() } });
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
