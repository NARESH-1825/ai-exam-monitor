// backend/middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');

exports.authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many login attempts. Try again in 15 minutes.' }
});

exports.apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
});
