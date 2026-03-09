// backend/controllers/monitorController.js
// REDESIGN: violationCount replaces cheatScore in all monitor data
const { getDB } = require('../config/firebase');
const getIO = () => { try { return require('../server').io; } catch { return null; } };

exports.getSubmissions = async (req, res) => {
  try {
    const db   = getDB();
    const snap = await db.collection('submissions').where('exam', '==', req.params.examId).get();
    const submissions = await Promise.all(snap.docs.map(async d => {
      const sub = { id: d.id, ...d.data() };

      // Populate student info
      try {
        const sd = await db.collection('users').doc(sub.student).get();
        if (sd.exists) {
          const { password: _, activeSessionId: __, ...safe } = sd.data();
          sub.studentInfo = { id: sd.id, ...safe };
        }
      } catch (_) {}

      // Populate violation events from proctoring log
      try {
        const ls = await db.collection('proctoringLogs')
          .where('submissionId', '==', sub.id).limit(1).get();
        if (!ls.empty) {
          const log = ls.docs[0].data();
          sub.violationEvents = log.events || [];
          // Prefer log violationCount if higher (more up-to-date)
          sub.violationCount  = Math.max(log.violationCount || 0, sub.violationCount || 0);
        } else {
          sub.violationEvents = [];
        }
      } catch (_) { sub.violationEvents = []; }

      return sub;
    }));
    submissions.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    res.json({ submissions });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.blockStudent = async (req, res) => {
  try {
    const db  = getDB();
    const now = new Date().toISOString();
    const { examId, studentId } = req.params;

    const subSnap = await db.collection('submissions')
      .where('exam', '==', examId).where('student', '==', studentId)
      .where('status', '==', 'ongoing').limit(1).get();

    let score = 0, totalMarks = 0, percentage = 0, submissionId = null;
    if (!subSnap.empty) {
      submissionId = subSnap.docs[0].id;
      const subData = subSnap.docs[0].data();
      const examDoc = await db.collection('exams').doc(examId).get();
      const examData = examDoc.data() || {};
      const graded = (examData.questions || []).map(q => {
        const qId = q._id || q.id; totalMarks += (q.marks || 1);
        const ans = (subData.answers || []).find(a => a.questionId === qId);
        const ok  = ans?.selectedOption === q.answer;
        if (ok) score += (q.marks || 1);
        return { questionId: qId, selectedOption: ans?.selectedOption || null, isCorrect: ok };
      });
      percentage = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;
      const passed = percentage >= (examData.passingScore || 40);
      await subSnap.docs[0].ref.update({
        answers: graded, score, totalMarks, percentage, passed,
        status: 'submitted', autoSubmitted: true,
        autoSubmitReason: 'Blocked by faculty',
        submittedAt: now, updatedAt: now,
      });
    }

    // Block user account
    await db.collection('users').doc(studentId).update({
      isBlocked: true, blockedReason: 'Blocked by faculty during exam',
      activeSessionId: null, updatedAt: now,
    });

    const io = getIO();
    io?.to(`user_${studentId}`).emit('exam:blocked', { reason: 'You have been blocked by faculty.' });
    io?.to(`monitor_${examId}`).emit('student:submitted', {
      studentId, submissionId, autoSubmitted: true,
      autoSubmitReason: 'Blocked by faculty', score, percentage,
    });

    res.json({ message: 'Student blocked and exam auto-submitted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getStudentLogs = async (req, res) => {
  try {
    const db   = getDB();
    const snap = await db.collection('proctoringLogs')
      .where('examId', '==', req.params.examId)
      .where('studentId', '==', req.params.studentId)
      .limit(1).get();
    const log = snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
    res.json({ log });
  } catch (err) { res.status(500).json({ message: err.message }); }
};
