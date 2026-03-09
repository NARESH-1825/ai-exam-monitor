# 🎓 AI Exam Monitor — Firebase Firestore Edition

Full-stack AI-proctored exam platform using **Firebase Firestore** as the database.

## ✨ Auth Features

| Feature                   | How it works                                                                                                                                    |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Single-device login**   | New login generates a new `sessionId` in Firestore. Old sessions get `SESSION_INVALIDATED` on next API call or via real-time Firestore listener |
| **Auto-login on new tab** | If valid token in localStorage, new tab verifies it with server and auto-logs in                                                                |
| **Cross-tab logout**      | Logout clears `activeSessionId` in Firestore. All tabs watching the user doc detect the change and redirect to `/login` simultaneously          |

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Firebase project (already configured)
- Firebase Admin SDK service account JSON

### Setup

```bash
# 1. Run setup script
./setup.sh          # Mac/Linux
setup.bat           # Windows

# 2. Place Firebase service account (REQUIRED)
# Download from Firebase Console → Project Settings → Service Accounts
# Save as: backend/firebase-service-account.json

# 3. Start backend (Terminal 1)
cd backend && npm run dev

# 4. Start frontend (Terminal 2)
cd frontend && npm run dev

# 5. Open http://localhost:5173
```

See **FIRESTORE_SETUP.md** for detailed Firebase configuration steps.

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│         React Frontend                  │
│  ┌──────────────────────────────────┐   │
│  │  Firebase Client SDK             │   │
│  │  • onSnapshot(users/{id})        │   │
│  │  • Watches activeSessionId       │   │
│  │  • Triggers cross-tab logout     │   │
│  └──────────────────────────────────┘   │
│  ┌──────────────────────────────────┐   │
│  │  localStorage Events             │   │
│  │  • 'auth_event' storage key      │   │
│  │  • LOGIN / LOGOUT broadcast      │   │
│  └──────────────────────────────────┘   │
└───────────────────┬─────────────────────┘
                    │ HTTP + WebSocket
┌───────────────────▼─────────────────────┐
│         Express Backend                 │
│  • JWT auth + session validation        │
│  • Socket.io proctoring events          │
│  • Firebase Admin SDK                   │
└───────────────────┬─────────────────────┘
                    │ Admin SDK (bypasses rules)
┌───────────────────▼─────────────────────┐
│         Firebase Firestore              │
│  Collections: users, exams, questions,  │
│  submissions, proctoringLogs            │
└─────────────────────────────────────────┘
```
