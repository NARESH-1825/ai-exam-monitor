# Quick Start Guide for Local Testing Before Deployment

## Prerequisites

- Node.js v18+ installed
- Firebase project created and credentials ready
- Git installed

## Step 1: Install Dependencies

### Backend

```powershell
cd backend
npm install
```

### Frontend

```powershell
cd frontend
npm install
```

## Step 2: Configure Environment Files

### Backend (backend/.env)

- Already configured with Firebase credentials
- PORT=5000 (default)
- JWT_SECRET is set

### Frontend (frontend/.env)

- Already configured to use localhost:5000
- VITE_API_URL=http://localhost:5000/api
- VITE_SOCKET_URL=http://localhost:5000

## Step 3: Start Development Servers

### Terminal 1 - Backend

```powershell
cd backend
npm run dev
```

Expected output:

```
✅ Firebase Admin SDK initialized
🚀 Server running on port 5000
```

### Terminal 2 - Frontend

```powershell
cd frontend
npm run dev
```

Expected output:

```
VITE v5.0.8  ready in 234 ms
➜  Local:   http://localhost:5173/
```

## Step 4: Test the Application

1. Open browser: http://localhost:5173
2. Try logging in with test credentials
3. Check browser DevTools:
   - Network tab: Should see requests to http://localhost:5000/api
   - Console: Should show NO CORS errors
   - Should see successful Firebase initialization

## Troubleshooting Locally

### Cannot connect to backend

- Is backend terminal running and showing "🚀 Server running"?
- Check port 5000 is not in use: `netstat -ano | findstr :5000`
- Kill conflicting process if needed

### Firebase initialization error

- Check backend/.env has all FIREBASE\_\* variables
- Verify FIREBASE_PRIVATE_KEY comes from your service account
- Check Firebase Console: Project Settings → Service Accounts

### CORS error when logging in

- Frontend should be on http://localhost:5173
- Backend's CLIENT_URL should be http://localhost:5173
- Restart backend after changing .env

### JSON parsing errors

- Ensure backend/.env FIREBASE_PRIVATE_KEY has \n preserved (not converted to newlines)
- The key should be one long line with \n characters in it

## Testing Features

### 1. Test Authentication

- Go to login page
- Try signing up / logging in
- Check Network tab: POST to /api/auth/login or /api/auth/signup
- Check response has JWT token

### 2. Test Firebase Connection

- Successful login means:
  - Backend connected to Firebase
  - User created in Firestore Database
  - JWT token generated successfully
- Go to Firebase Console → Firestore → Collections → Should see users collection

### 3. Test Socket Connection (if implemented)

- Check browser console for Socket.io connection
- Should see: "Socket connection: connected" or similar
- If exam/monitor features use WebSocket, they should work

## Next Steps

When local testing works perfectly:

1. Push code to GitHub
2. Follow DEPLOYMENT_GUIDE.md for Render & Netlify setup
3. Everything should work the same in production
