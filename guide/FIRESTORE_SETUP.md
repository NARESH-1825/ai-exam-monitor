# 🔥 Firebase Firestore Setup Guide

## Step 1: Get Firebase Admin SDK Service Account

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **ai--exam-5c49e**
3. Click **Project Settings** (gear icon)
4. Go to **Service Accounts** tab
5. Click **Generate new private key**
6. Download the JSON file
7. **Rename it** to `firebase-service-account.json`
8. **Place it** at: `backend/firebase-service-account.json`

⚠️ **NEVER commit this file to Git!** Add it to `.gitignore`

## Step 2: Set Up Firestore Database

1. In Firebase Console → **Firestore Database** → **Create database**
2. Choose **Start in test mode** (for development)
3. Select a region and click **Enable**

## Step 3: Set Firestore Security Rules

In Firebase Console → Firestore → **Rules**, paste:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection — allow reading your own document for session sync
    match /users/{userId} {
      allow read: if true; // Needed for client-side session listener
      allow write: if false; // Only backend (Admin SDK) can write
    }

    // All other collections — backend only
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

> **Why?** The frontend needs to `READ` the user document in Firestore to watch 
> for session changes (cross-tab logout, session invalidation). The backend 
> (Firebase Admin SDK) bypasses these rules entirely.

## Step 4: Create Indexes

The backend uses compound queries. In Firebase Console → **Indexes**, add:

| Collection | Fields | Order |
|-----------|--------|-------|
| `submissions` | `student` ASC, `createdAt` DESC | Composite |
| `submissions` | `exam` ASC, `createdAt` DESC | Composite |
| `questions` | `faculty` ASC, `createdAt` DESC | Composite |
| `exams` | `faculty` ASC, `createdAt` DESC | Composite |
| `proctoringLogs` | `exam` ASC, `student` ASC | Composite |

**OR** just run the app and Firebase will show you index creation links in the console errors.

## Step 5: Run the App

```bash
# Install backend
cd backend && npm install

# Install frontend
cd ../frontend && npm install

# Terminal 1 — Start backend
cd backend && npm run dev

# Terminal 2 — Start frontend
cd ../frontend && npm run dev
```

Open: http://localhost:5173
