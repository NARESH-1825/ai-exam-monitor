// backend/routes/student.js
const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const { getDB } = require('../config/firebase');

router.get('/profile', protect, authorize('student'), async (req, res) => {
  try {
    const db = getDB();
    const doc = await db.collection('users').doc(req.user.userId).get();
    if (!doc.exists) return res.status(404).json({ message: 'Not found' });
    const { password: _, activeSessionId: __, activeDeviceFingerprint: ___, ...safe } = doc.data();
    res.json({ user: { id: doc.id, ...safe } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/submissions', protect, authorize('student'), async (req, res) => {
  try {
    const db = getDB();
    const snap = await db.collection('submissions')
      .where('student', '==', req.user.userId)
      .get();

    // Deduplicate by exam ID — keep only the most recent submission per exam
    const byExam = {};
    snap.docs.forEach(d => {
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
          sub.exam = { id: examDoc.id, title: e.title, duration: e.duration, passingScore: e.passingScore };
        }
      }

      // Fetch proctoring log events for this submission
      try {
        const logSnap = await db.collection('proctoringLogs')
          .where('submissionId', '==', sub.id)
          .limit(1)
          .get();
        if (!logSnap.empty) {
          const log = logSnap.docs[0].data();
          sub.cheatEvents = log.events || [];
          if (!sub.cheatScore) sub.cheatScore = log.cheatScore || 0;
        } else {
          sub.cheatEvents = [];
        }
      } catch (_) {
        sub.cheatEvents = [];
      }

      return sub;
    }));

    // Sort newest first in memory
    submissions.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    res.json({ submissions });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/student/attempted-exams — returns exam IDs this student already attempted
router.get('/attempted-exams', protect, authorize('student'), async (req, res) => {
  try {
    const db = getDB();
    const snap = await db.collection('submissions')
      .where('student', '==', req.user.userId)
      .get();
    const examIds = [...new Set(
      snap.docs.map(d => {
        const exam = d.data().exam;
        return typeof exam === 'string' ? exam : (exam?.id || '');
      }).filter(Boolean)
    )];
    res.json({ attemptedExamIds: examIds });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
