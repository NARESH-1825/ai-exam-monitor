// backend/controllers/authController.js
// Uses Firebase Firestore instead of MongoDB
const bcrypt = require('bcryptjs');
const { getDB } = require('../config/firebase');
const { generateToken, generateSessionId } = require('../utils/tokenUtils');
const { generateFingerprint } = require('../utils/deviceFingerprint');

// POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const { name, email, password, role, rollNumber, department } = req.body;
    const db = getDB();

    // Check existing
    const snap = await db.collection('users').where('email', '==', email.toLowerCase()).limit(1).get();
    if (!snap.empty) return res.status(400).json({ message: 'Email already registered' });

    const hashedPassword = await bcrypt.hash(password, 12);
    const now = new Date().toISOString();

    const docRef = await db.collection('users').add({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role,
      rollNumber: rollNumber || '',
      department: department || '',
      avatar: '',
      activeSessionId: null,
      activeDeviceFingerprint: null,
      lastLoginAt: null,
      isBlocked: false,
      blockedReason: '',
      createdAt: now,
      updatedAt: now,
    });

    res.status(201).json({ message: 'User registered successfully', userId: docRef.id });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// POST /api/auth/login
// Feature 1: Deny multiple simultaneous logins — new login invalidates old session (new sessionId)
exports.login = async (req, res) => {
  try {
    const { email, password, deviceInfo } = req.body;
    const db = getDB();

    // Find user by email
    const snap = await db.collection('users').where('email', '==', email.toLowerCase()).limit(1).get();
    if (snap.empty) return res.status(401).json({ message: 'Invalid credentials' });

    const userDoc = snap.docs[0];
    const user = { id: userDoc.id, ...userDoc.data() };

    if (user.isBlocked) return res.status(403).json({ message: `Account blocked: ${user.blockedReason}` });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

    // Generate a NEW sessionId — this invalidates any existing session automatically
    // Any tab using the old token will get SESSION_INVALIDATED on next API call
    const sessionId = generateSessionId();
    const deviceFingerprint = generateFingerprint(deviceInfo);
    const now = new Date().toISOString();

    await userDoc.ref.update({
      activeSessionId: sessionId,
      activeDeviceFingerprint: deviceFingerprint,
      lastLoginAt: now,
      updatedAt: now,
    });

    const token = generateToken({
      userId: user.id,
      role: user.role,
      sessionId,
    });

    res.cookie('examToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 8 * 60 * 60 * 1000, // 8 hours
    });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        rollNumber: user.rollNumber,
        department: user.department,
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// POST /api/auth/logout
// Clears session from Firestore so all other tabs get invalidated
exports.logout = async (req, res) => {
  try {
    const db = getDB();
    const userRef = db.collection('users').doc(req.user.userId);
    await userRef.update({
      activeSessionId: null,
      activeDeviceFingerprint: null,
      updatedAt: new Date().toISOString(),
    });
    res.clearCookie('examToken');
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ message: 'Logout failed' });
  }
};

// GET /api/auth/me
exports.getMe = async (req, res) => {
  try {
    const db = getDB();
    const userDoc = await db.collection('users').doc(req.user.userId).get();
    if (!userDoc.exists) return res.status(404).json({ message: 'User not found' });

    const u = userDoc.data();
    // Don't send password or session internals
    const { password: _, activeSessionId: __, activeDeviceFingerprint: ___, ...safeUser } = u;
    res.json({ user: { id: userDoc.id, ...safeUser } });
  } catch (err) {
    console.error('GetMe error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
