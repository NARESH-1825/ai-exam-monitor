// backend/controllers/authController.js
// Uses Firebase Firestore instead of MongoDB
const bcrypt = require('bcryptjs');
const { getDB } = require('../config/firebase');
const { generateToken, generateSessionId } = require('../utils/tokenUtils');
const { generateFingerprint } = require('../utils/deviceFingerprint');
const { sendEmail } = require('../utils/emailService');

// POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const { name, email, password, role, rollNumber, department } = req.body;
    const db = getDB();

    // Check existing
    const snap = await db.collection('users').where('email', '==', email.toLowerCase().trim()).limit(1).get();
    if (!snap.empty) return res.status(400).json({ message: 'Email already registered' });

    if (!password || password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const docId = `reg_${email.toLowerCase().trim()}`;
    await db.collection('otp_verifications').doc(docId).set({
      email: email.toLowerCase().trim(),
      otp,
      expiresAt,
      type: 'register',
      registrationData: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        role,
        rollNumber: rollNumber || '',
        department: department || '',
      }
    });

    console.log(`[DEV] Generated Registration OTP for ${email}: ${otp}`);

    await sendEmail({
      to: email.toLowerCase().trim(),
      subject: 'Verify Your Email - AI Exam Monitor',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 5px;">
          <h2 style="color: #3b82f6; text-align: center;">Email Verification Code</h2>
          <p>Hello,</p>
          <p>Thank you for registering on the AI Exam Monitor platform. Use the verification code below to complete your registration:</p>
          <div style="background: #f3f4f6; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0; border-radius: 5px;">
            ${otp}
          </div>
          <p style="color: #ef4444; font-size: 13px;">This code is valid for 10 minutes. If you did not register, please ignore this email.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #888; text-align: center;">Secure Proctored Exam Platform</p>
        </div>
      `
    });

    res.status(200).json({ message: 'OTP sent to email. Please verify.', email: email.toLowerCase().trim() });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// POST /api/auth/login
// Concurrent Session Control: if already logged in, require email OTP authorization
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

    // ── Concurrent Session: active session exists → require OTP authorization ──
    if (user.activeSessionId) {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      // 3-minute expiry
      const expiresAt = new Date(Date.now() + 3 * 60 * 1000).toISOString();
      const docId = `concurrent_${email.toLowerCase().trim()}`;

      await db.collection('otp_verifications').doc(docId).set({
        email: email.toLowerCase().trim(),
        otp,
        expiresAt,
        type: 'concurrent_login',
        deviceInfo: deviceInfo || {},
      });

      console.log(`[DEV] Concurrent Login OTP for ${email}: ${otp} (expires in 3 min)`);

      await sendEmail({
        to: email.toLowerCase().trim(),
        subject: '⚠️ New Login Attempt - Authorization Required',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: auto; border: 1px solid #f97316; border-radius: 5px;">
            <h2 style="color: #f97316; text-align: center;">⚠️ New Login Attempt Detected</h2>
            <p>Hello,</p>
            <p>Someone is trying to log into your <strong>AI Exam Monitor</strong> account on a <strong>new device</strong>. Your current session is still active.</p>
            <p>If this is you, enter the authorization code below to allow the new login. <strong>Your current session will be ended.</strong></p>
            <div style="background: #fff7ed; padding: 15px; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 8px; margin: 20px 0; border-radius: 5px; border: 2px solid #f97316;">
              ${otp}
            </div>
            <p style="color: #ef4444; font-size: 13px;">⏱️ This code expires in <strong>3 minutes</strong>.</p>
            <p style="color: #6b7280; font-size: 12px;">If this was NOT you, ignore this email. Your current session remains active and the new login attempt will fail automatically.</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 12px; color: #888; text-align: center;">AI Exam Monitor · Secure Proctored Exam Platform</p>
          </div>
        `
      });

      return res.status(200).json({
        code: 'CONCURRENT_SESSION_DETECTED',
        message: 'An active session exists. An authorization code has been sent to your email.',
        email: email.toLowerCase().trim(),
      });
    }

    // ── No active session → normal login ──────────────────────────────────────
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

// POST /api/auth/confirm-concurrent-login
// Verifies the OTP sent during concurrent session detection and completes the new login
exports.confirmConcurrentLogin = async (req, res) => {
  try {
    const { email, password, otp, deviceInfo } = req.body;
    const db = getDB();

    if (!email || !password || !otp) {
      return res.status(400).json({ message: 'Email, password and OTP are required' });
    }

    // Re-verify credentials
    const snap = await db.collection('users').where('email', '==', email.toLowerCase().trim()).limit(1).get();
    if (snap.empty) return res.status(401).json({ message: 'Invalid credentials' });

    const userDoc = snap.docs[0];
    const user = { id: userDoc.id, ...userDoc.data() };

    if (user.isBlocked) return res.status(403).json({ message: `Account blocked: ${user.blockedReason}` });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

    // Verify OTP
    const docId = `concurrent_${email.toLowerCase().trim()}`;
    const otpRef = db.collection('otp_verifications').doc(docId);
    const otpDoc = await otpRef.get();

    if (!otpDoc.exists) {
      return res.status(400).json({ message: 'Authorization expired or not found. Please try logging in again.' });
    }

    const verification = otpDoc.data();

    if (new Date() > new Date(verification.expiresAt)) {
      await otpRef.delete();
      return res.status(400).json({
        message: 'Authorization code expired (3 minutes). Please try logging in again.',
        code: 'CONCURRENT_OTP_EXPIRED'
      });
    }

    if (verification.otp !== otp.trim()) {
      return res.status(400).json({ message: 'Incorrect authorization code.' });
    }

    // OTP valid — generate new session (this atomically kicks the old device via Firestore listener)
    const sessionId = generateSessionId();
    const deviceFingerprint = generateFingerprint(deviceInfo);
    const now = new Date().toISOString();

    await userDoc.ref.update({
      activeSessionId: sessionId,
      activeDeviceFingerprint: deviceFingerprint,
      lastLoginAt: now,
      updatedAt: now,
    });

    await otpRef.delete();

    const token = generateToken({
      userId: user.id,
      role: user.role,
      sessionId,
    });

    // Emit instant logout event to previous session via socket room
    if (req.io) {
      req.io.to(`user_${user.id}`).emit('session:terminated', { reason: 'concurrent_login' });
    }

    res.cookie('examToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 8 * 60 * 60 * 1000,
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
    console.error('Confirm concurrent login error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
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

// POST /api/auth/verify-otp
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp, type } = req.body;
    const db = getDB();

    if (!email || !otp || !type) {
      return res.status(400).json({ message: 'Email, OTP and type are required' });
    }

    const docId = type === 'register' ? `reg_${email.toLowerCase().trim()}` : `reset_${email.toLowerCase().trim()}`;
    const otpRef = db.collection('otp_verifications').doc(docId);
    const otpDoc = await otpRef.get();

    if (!otpDoc.exists) {
      return res.status(400).json({ message: 'Invalid OTP or session expired. Please request a new one.' });
    }

    const verification = otpDoc.data();

    if (new Date() > new Date(verification.expiresAt)) {
      await otpRef.delete();
      return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
    }

    if (verification.otp !== otp.trim()) {
      return res.status(400).json({ message: 'Incorrect OTP code.' });
    }

    if (type === 'register') {
      const { name, email: regEmail, password: hashedPassword, role, rollNumber, department } = verification.registrationData;

      const userSnap = await db.collection('users').where('email', '==', regEmail.toLowerCase()).limit(1).get();
      if (!userSnap.empty) {
        await otpRef.delete();
        return res.status(400).json({ message: 'Email already registered' });
      }

      const now = new Date().toISOString();
      const docRef = await db.collection('users').add({
        name: name.trim(),
        email: regEmail.toLowerCase().trim(),
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

      await otpRef.delete();
      return res.status(201).json({ message: 'User registered successfully', userId: docRef.id });
    }

    return res.status(400).json({ message: 'Invalid verification type' });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// POST /api/auth/forgot-password
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const db = getDB();

    if (!email) return res.status(400).json({ message: 'Email is required' });

    const userSnap = await db.collection('users').where('email', '==', email.toLowerCase().trim()).limit(1).get();
    if (userSnap.empty) {
      return res.status(404).json({ message: 'No account found with this email address' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const docId = `reset_${email.toLowerCase().trim()}`;
    await db.collection('otp_verifications').doc(docId).set({
      email: email.toLowerCase().trim(),
      otp,
      expiresAt,
      type: 'password_reset'
    });

    console.log(`[DEV] Generated Password Reset OTP for ${email}: ${otp}`);

    await sendEmail({
      to: email.toLowerCase().trim(),
      subject: 'Reset Your Password - AI Exam Monitor',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 5px;">
          <h2 style="color: #3b82f6; text-align: center;">Password Reset Request</h2>
          <p>Hello,</p>
          <p>We received a request to reset your password for the AI Exam Monitor platform. Use the verification code below to set a new password:</p>
          <div style="background: #f3f4f6; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0; border-radius: 5px;">
            ${otp}
          </div>
          <p style="color: #ef4444; font-size: 13px;">This code is valid for 10 minutes. If you did not request a password reset, please ignore this email.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #888; text-align: center;">Secure Proctored Exam Platform</p>
        </div>
      `
    });

    res.json({ message: 'Password reset OTP sent to email' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// POST /api/auth/reset-password
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const db = getDB();

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const docId = `reset_${email.toLowerCase().trim()}`;
    const otpRef = db.collection('otp_verifications').doc(docId);
    const otpDoc = await otpRef.get();

    if (!otpDoc.exists) {
      return res.status(400).json({ message: 'Invalid OTP or session expired. Please request a new one.' });
    }

    const verification = otpDoc.data();

    if (new Date() > new Date(verification.expiresAt)) {
      await otpRef.delete();
      return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
    }

    if (verification.otp !== otp.trim()) {
      return res.status(400).json({ message: 'Incorrect OTP code.' });
    }

    const userSnap = await db.collection('users').where('email', '==', email.toLowerCase().trim()).limit(1).get();
    if (userSnap.empty) {
      await otpRef.delete();
      return res.status(404).json({ message: 'User not found' });
    }

    const userDoc = userSnap.docs[0];
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    const now = new Date().toISOString();

    await userDoc.ref.update({
      password: hashedPassword,
      updatedAt: now
    });

    await otpRef.delete();
    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// POST /api/auth/resend-otp
exports.resendOtp = async (req, res) => {
  try {
    const { email, type } = req.body;
    const db = getDB();

    if (!email || !type) {
      return res.status(400).json({ message: 'Email and type are required' });
    }

    const docId = type === 'register' ? `reg_${email.toLowerCase().trim()}` : `reset_${email.toLowerCase().trim()}`;
    const otpRef = db.collection('otp_verifications').doc(docId);
    const otpDoc = await otpRef.get();

    if (!otpDoc.exists) {
      return res.status(400).json({ message: 'No pending request found for this email. Please submit the form again.' });
    }

    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await otpRef.update({
      otp: newOtp,
      expiresAt
    });

    console.log(`[DEV] Resent OTP (${type}) for ${email}: ${newOtp}`);

    if (type === 'register') {
      await sendEmail({
        to: email.toLowerCase().trim(),
        subject: 'Verify Your Email - AI Exam Monitor',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 5px;">
            <h2 style="color: #3b82f6; text-align: center;">Email Verification Code</h2>
            <p>Hello,</p>
            <p>Thank you for registering on the AI Exam Monitor platform. Use the verification code below to complete your registration:</p>
            <div style="background: #f3f4f6; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0; border-radius: 5px;">
              ${newOtp}
            </div>
            <p style="color: #ef4444; font-size: 13px;">This code is valid for 10 minutes. If you did not register, please ignore this email.</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 12px; color: #888; text-align: center;">Secure Proctored Exam Platform</p>
          </div>
        `
      });
    } else if (type === 'concurrent_login') {
      // Concurrent login resend uses 3-minute expiry
      await otpRef.update({ otp: newOtp, expiresAt: new Date(Date.now() + 3 * 60 * 1000).toISOString() });
      await sendEmail({
        to: email.toLowerCase().trim(),
        subject: '⚠️ New Login Attempt - Authorization Required',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: auto; border: 1px solid #f97316; border-radius: 5px;">
            <h2 style="color: #f97316; text-align: center;">⚠️ New Login Attempt Detected</h2>
            <p>Hello,</p>
            <p>A new authorization code has been requested for a login attempt on a new device.</p>
            <div style="background: #fff7ed; padding: 15px; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 8px; margin: 20px 0; border-radius: 5px; border: 2px solid #f97316;">
              ${newOtp}
            </div>
            <p style="color: #ef4444; font-size: 13px;">⏱️ This code expires in <strong>3 minutes</strong>.</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 12px; color: #888; text-align: center;">AI Exam Monitor · Secure Proctored Exam Platform</p>
          </div>
        `
      });
    } else {
      await sendEmail({
        to: email.toLowerCase().trim(),
        subject: 'Reset Your Password - AI Exam Monitor',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 5px;">
            <h2 style="color: #3b82f6; text-align: center;">Password Reset Request</h2>
            <p>Hello,</p>
            <p>We received a request to reset your password for the AI Exam Monitor platform. Use the verification code below to set a new password:</p>
            <div style="background: #f3f4f6; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0; border-radius: 5px;">
              ${newOtp}
            </div>
            <p style="color: #ef4444; font-size: 13px;">This code is valid for 10 minutes. If you did not request a password reset, please ignore this email.</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 12px; color: #888; text-align: center;">Secure Proctored Exam Platform</p>
          </div>
        `
      });
    }

    res.json({ message: 'Verification OTP sent successfully' });
  } catch (err) {
    console.error('Resend OTP error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
