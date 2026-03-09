// backend/routes/exam.js
const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const {
  createExam, getFacultyExams, getExam, launchExam, endExam,
  getAvailableExams, startExam, submitExam, getResults
} = require('../controllers/examController');

// Faculty
router.post('/', protect, authorize('faculty'), createExam);
router.get('/faculty', protect, authorize('faculty'), getFacultyExams);
router.get('/:id', protect, getExam);
router.put('/:id/launch', protect, authorize('faculty'), launchExam);
router.put('/:id/end', protect, authorize('faculty'), endExam);

// Student
router.get('/', protect, authorize('student'), getAvailableExams);
router.post('/:id/start', protect, authorize('student'), startExam);
router.post('/submit', protect, authorize('student'), submitExam);
router.get('/student/results', protect, authorize('student'), getResults);

module.exports = router;
