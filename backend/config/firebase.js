// backend/config/firebase.js
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

let db = null;

const initFirebase = () => {
  if (admin.apps.length > 0) {
    db = admin.firestore();
    return db;
  }

  try {
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './firebase-service-account.json';
    const resolvedPath = path.resolve(serviceAccountPath);

    if (!fs.existsSync(resolvedPath)) {
      console.error('❌ Firebase service account file not found at:', resolvedPath);
      console.error('   Please download it from Firebase Console → Project Settings → Service Accounts');
      console.error('   and save it as backend/firebase-service-account.json');
      process.exit(1);
    }

    const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    db = admin.firestore();
    console.log('✅ Firebase Admin SDK initialized');
    return db;
  } catch (err) {
    console.error('❌ Firebase initialization error:', err.message);
    process.exit(1);
  }
};

const getDB = () => {
  if (!db) throw new Error('Firebase not initialized');
  return db;
};

module.exports = { initFirebase, getDB, admin };
