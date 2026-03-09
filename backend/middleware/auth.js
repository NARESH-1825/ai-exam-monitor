// backend/middleware/auth.js
const jwt = require('jsonwebtoken');
const { getDB } = require('../config/firebase');

const protect = async (req, res, next) => {
  try {
    let token = req.cookies?.examToken;
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) return res.status(401).json({ message: 'No token, access denied' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const db = getDB();

    // Verify session is still active in Firestore (single-device enforcement)
    const userDoc = await db.collection('users').doc(decoded.userId).get();
    if (!userDoc.exists) return res.status(401).json({ message: 'User not found' });

    const user = userDoc.data();
    if (user.isBlocked) return res.status(403).json({ message: 'Account blocked' });

    // If sessionId doesn't match → user logged in elsewhere → kick this session
    if (user.activeSessionId !== decoded.sessionId) {
      return res.status(401).json({
        message: 'Session expired. Logged in from another device.',
        code: 'SESSION_INVALIDATED'
      });
    }

    req.user = { ...decoded, userId: decoded.userId };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError')
      return res.status(401).json({ message: 'Token expired', code: 'TOKEN_EXPIRED' });
    return res.status(401).json({ message: 'Invalid token' });
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role))
    return res.status(403).json({ message: 'Access denied: insufficient role' });
  next();
};

module.exports = { protect, authorize };
