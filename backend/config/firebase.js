const admin = require("firebase-admin");
let db = null;

function initFirebase() {
  if (admin.apps.length) {
    db = admin.firestore();
    return db;
  }

  let credential;

  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      credential = admin.credential.cert(serviceAccount);
    } else {
      // Local dev: read from file
      credential = admin.credential.cert(
        require("../firebase-service-account.json"),
      );
    }

    admin.initializeApp({ credential });
    console.log("✅ Firebase Admin initialized");

    db = admin.firestore();
    console.log("✅ Firebase Admin SDK initialized");
    return db;
  } catch (err) {
    console.error("❌ Firebase initialization error:", err.message);
    process.exit(1);
  }

  // Production: read from environment variable
}

const getDB = () => {
  if (!db) throw new Error("Firebase not initialized");
  return db;
};

module.exports = { initFirebase, getDB, admin };

/*
const admin = require("firebase-admin");

let db = null;

const initFirebase = () => {
  if (admin.apps.length > 0) {
    db = admin.firestore();
    return db;
  }
  try {
    // Validate required environment variables
    const requiredEnvVars = [
      "FIREBASE_TYPE",
      "FIREBASE_PROJECT_ID",
      "FIREBASE_PRIVATE_KEY_ID",
      "FIREBASE_PRIVATE_KEY",
      "FIREBASE_CLIENT_EMAIL",
      "FIREBASE_CLIENT_ID",
      "FIREBASE_AUTH_URI",
      "FIREBASE_TOKEN_URI",
      "FIREBASE_AUTH_PROVIDER_X509_CERT_URL",
      "FIREBASE_CLIENT_X509_CERT_URL",
      "FIREBASE_UNIVERSE_DOMAIN",
    ];

    const missingEnvVars = requiredEnvVars.filter(
      (varName) => !process.env[varName],
    );

    if (missingEnvVars.length > 0) {
      console.error(
        "❌ Missing Firebase environment variables:",
        missingEnvVars.join(", "),
      );
      console.error("   Please add the following to your .env file:");
      console.error(requiredEnvVars.map((v) => `   ${v}=`).join("\n"));
      process.exit(1);
    }

    // Construct service account from environment variables
    const serviceAccount = {
      type: process.env.FIREBASE_TYPE,
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"), // Handle escaped newlines
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: process.env.FIREBASE_AUTH_URI,
      token_uri: process.env.FIREBASE_TOKEN_URI,
      auth_provider_x509_cert_url:
        process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
      client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
      universe_domain: process.env.FIREBASE_UNIVERSE_DOMAIN,
    };

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    db = admin.firestore();
    console.log("✅ Firebase Admin SDK initialized");
    return db;
  } catch (err) {
    console.error("❌ Firebase initialization error:", err.message);
    process.exit(1);
  }
};

const getDB = () => {
  if (!db) throw new Error("Firebase not initialized");
  return db;
};

module.exports = { initFirebase, getDB, admin };
*/
