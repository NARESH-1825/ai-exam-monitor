// backend/routes/faculty.js
const router = require('express').Router();
const multer = require('multer');
const { protect, authorize } = require('../middleware/auth');
const {
  getStudents, getStudentDetail, blockStudent, unblockStudent,
  getQuestions, createQuestion, updateQuestion, deleteQuestion,
  getPapers, getPaper, createPaper, updatePaper, deletePaper,
  getExamResults,
} = require('../controllers/facultyController');
const { importQuestionPaper } = require('../controllers/importController');

// Multer: in-memory storage, max 10 MB, allowed MIME types
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const allowed = [
      'application/pdf',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/csv',
      'application/csv',
      'text/plain', // some CSV uploads come as text/plain
    ];
    const okByName = /\.(pdf|xls|xlsx|doc|docx|csv)$/i.test(file.originalname);
    if (allowed.includes(file.mimetype) || okByName) return cb(null, true);
    cb(new Error('Unsupported file format. Allowed: PDF, XLS, XLSX, DOC, DOCX, CSV'));
  },
});

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
router.get('/papers/:id', getPaper);
router.post('/papers', createPaper);
router.put('/papers/:id', updatePaper);
router.delete('/papers/:id', deletePaper);

// Import Question Paper (file upload → parse → return preview)
router.post('/import', upload.single('file'), importQuestionPaper);

module.exports = router;
