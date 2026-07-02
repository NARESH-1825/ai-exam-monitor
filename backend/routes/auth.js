// backend/routes/auth.js
const router = require('express').Router();
const { register, login, logout, getMe, verifyOtp, forgotPassword, resetPassword, resendOtp, confirmConcurrentLogin } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

router.post('/register', register);
router.post('/login', authLimiter, login);
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);

// OTP & Password Reset routes
router.post('/verify-otp', authLimiter, verifyOtp);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password', authLimiter, resetPassword);
router.post('/resend-otp', authLimiter, resendOtp);

// Concurrent Session Control
router.post('/confirm-concurrent-login', authLimiter, confirmConcurrentLogin);

module.exports = router;
