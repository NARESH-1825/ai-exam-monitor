// backend/routes/faculty.js
const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getStudents, getStudentDetail, blockStudent, unblockStudent,
  getQuestions, createQuestion, updateQuestion, deleteQuestion,
  getPapers, createPaper, updatePaper, deletePaper,
  getExamResults,
} = require('../controllers/facultyController');

router.use(protect, authorize('faculty'));

router.get('/students', getStudents);
router.get('/students/:id', getStudentDetail);
router.post('/students/:studentId/block', blockStudent);
router.post('/students/:studentId/unblock', unblockStudent);

router.get('/exam-results/:examId', getExamResults);

router.get('/questions', getQuestions);
router.post('/questions', createQuestion);
router.put('/questions/:id', updateQuestion);
router.delete('/questions/:id', deleteQuestion);

// Question Papers
router.get('/papers', getPapers);
router.post('/papers', createPaper);
router.put('/papers/:id', updatePaper);
router.delete('/papers/:id', deletePaper);

module.exports = router;
