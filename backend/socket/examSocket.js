// backend/socket/examSocket.js
// REDESIGN: violation COUNT (not score)
//   - Each proctor:event = +1 violation regardless of type
//   - At 3 violations → auto-submit with score=0, cheated=true
//   - Threshold is always 3 (hard-coded, no per-exam config needed)
const jwt   = require('jsonwebtoken');
const { getDB } = require('../config/firebase');

const LIMIT = 3; // violations before auto-submit

exports.setupExamSocket = (io) => {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      socket.user = jwt.verify(token, process.env.JWT_SECRET);
      next();
    } catch { next(new Error('Invalid token')); }
  });

  io.on('connection', socket => {
    const userId = socket.user.userId;
    socket.join(`user_${userId}`);

    socket.on('join:exam',    ({ examId }) => socket.join(`exam_${examId}`));
    socket.on('join:monitor', ({ examId }) => {
      if (socket.user.role === 'faculty') socket.join(`monitor_${examId}`);
    });

    // ── Proctoring event from student ────────────────────────────────────────
    socket.on('proctor:event', async ({ submissionId, logId, examId: evExamId, event }) => {
      try {
        const db  = getDB();
        const now = new Date().toISOString();

        // Resolve proctoring log
        let logRef;
        if (logId) {
          logRef = db.collection('proctoringLogs').doc(logId);
        } else {
          const snap = await db.collection('proctoringLogs')
            .where('submissionId', '==', submissionId).limit(1).get();
          if (snap.empty) return;
          logRef = snap.docs[0].ref;
        }

        const logDoc = await logRef.get();
        if (!logDoc.exists) return;
        const log = logDoc.data();

        const examId = evExamId || log.examId;

        // Each event = +1 violation count
        const newEvents = [...(log.events || []), event];
        const vc        = newEvents.length;          // violation count = total events

        await logRef.update({ events: newEvents, violationCount: vc, updatedAt: now });

        // Mirror to submission for live monitor display
        if (submissionId) {
          await db.collection('submissions').doc(submissionId).update({
            violationCount: vc, updatedAt: now,
          });
        }

        // Push live update to faculty monitor
        if (examId) {
          io.to(`monitor_${examId}`).emit('proctor:update', {
            studentId: userId, event, violationCount: vc, submissionId,
          });
        }

        // ── Auto-submit at LIMIT violations ─────────────────────────────────
        if (vc >= LIMIT && submissionId) {
          const subDoc = await db.collection('submissions').doc(submissionId).get();
          if (subDoc.exists && subDoc.data().status === 'ongoing') {

            // Get exam to know totalMarks
            let totalMarks = 0;
            if (examId) {
              const examDoc = await db.collection('exams').doc(examId).get();
              if (examDoc.exists) {
                totalMarks = (examDoc.data().questions || []).reduce((s, q) => s + (q.marks || 1), 0);
              }
            }

            // Score = 0, cheated = true
            await db.collection('submissions').doc(submissionId).update({
              status: 'submitted', autoSubmitted: true,
              autoSubmitReason: 'Violation limit reached',
              cheated: true,
              score: 0, totalMarks, percentage: 0, passed: false,
              violationCount: vc,
              submittedAt: now, updatedAt: now,
            });

            socket.emit('exam:blocked', {
              reason: `Exam auto-submitted: ${LIMIT} violations detected.`,
            });

            if (examId) {
              io.to(`monitor_${examId}`).emit('student:submitted', {
                studentId: userId, submissionId,
                autoSubmitted: true, cheated: true,
                violationCount: vc, score: 0, percentage: 0, passed: false,
                autoSubmitReason: 'Violation limit reached',
              });
            }
          }
        }
      } catch (err) { console.error('proctor:event error:', err); }
    });

    // ── Faculty force-block student ───────────────────────────────────────────
    socket.on('force:block', async ({ examId, studentId }) => {
      try {
        const db  = getDB();
        const now = new Date().toISOString();

        const subSnap = await db.collection('submissions')
          .where('exam', '==', examId)
          .where('student', '==', studentId)
          .where('status', '==', 'ongoing')
          .limit(1).get();

        let score = 0, percentage = 0, totalMarks = 0;
        if (!subSnap.empty) {
          const subData = subSnap.docs[0].data();
          const examDoc = await db.collection('exams').doc(examId).get();
          const examData = examDoc.data() || {};
          const graded = (examData.questions || []).map(q => {
            const qId = q._id || q.id;
            totalMarks += (q.marks || 1);
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

        io.to(`user_${studentId}`).emit('exam:blocked', {
          reason: 'You have been blocked by faculty. Your exam has been submitted.',
        });
        io.to(`monitor_${examId}`).emit('student:submitted', {
          studentId, submissionId: subSnap.empty ? null : subSnap.docs[0].id,
          autoSubmitted: true, autoSubmitReason: 'Blocked by faculty',
          score, percentage,
        });
      } catch (err) { console.error('force:block error:', err); }
    });

    socket.on('disconnect', () => { /* no-op */ });
  });
};
