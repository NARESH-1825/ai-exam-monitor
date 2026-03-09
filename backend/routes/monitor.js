// backend/routes/monitor.js
const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const { getSubmissions, blockStudent, getStudentLogs } = require('../controllers/monitorController');

router.use(protect, authorize('faculty'));

router.get('/:examId/submissions', getSubmissions);
router.post('/:examId/block/:studentId', blockStudent);
router.get('/:examId/logs/:studentId', getStudentLogs);

module.exports = router;
