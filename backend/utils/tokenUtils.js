// backend/utils/tokenUtils.js
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

exports.generateToken = (payload) => jwt.sign(
  payload,
  process.env.JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRE || '8h' }
);

exports.verifyToken = (token) => jwt.verify(token, process.env.JWT_SECRET);

exports.generateSessionId = () => uuidv4();
