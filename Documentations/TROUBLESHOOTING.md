# 🔧 Deployment Troubleshooting Guide

## Common Issues & Solutions

---

## ISSUE 1: Frontend Shows "Cannot Reach Backend"

### Symptoms

- White page with error in DevTools console
- Error: `Failed to fetch from https://...`
- Network requests are 0/failed

### Root Cause

- Backend URL in frontend `.env` is wrong
- Backend is not deployed or still deploying
- CORS not configured correctly

### Solutions

**Step 1**: Verify backend is running

1. Go to Render dashboard
2. Find your backend service
3. Check status shows "Live" (green)
4. Visit `https://your-backend-url.onrender.com/api/health` directly in browser
5. Should see: `{"status":"OK","timestamp":"..."}`

**Step 2**: Check frontend environment variables on Netlify

1. Go to Netlify → Site settings → Build & deploy → Environment
2. Check `VITE_API_URL` exactly matches your backend URL
3. Format should be: `https://your-service-name.onrender.com/api`
4. Redeploy: Go to Deploys → Trigger deploy

**Step 3**: Clear browser cache

1. Open DevTools → Settings → Network → Check "Disable cache"
2. Hard refresh: `Ctrl+Shift+R` (or `Cmd+Shift+R` on Mac)
3. Try again

**Step 4**: Check backend logs for errors

1. Render → Logs tab
2. Look for any error messages
3. If you see Firebase errors, see ISSUE 3

---

## ISSUE 2: CORS Error When Making API Calls

### Symptoms

```
Access to XMLHttpRequest at 'https://...' from origin
'https://your-site.netlify.app' has been blocked by CORS policy
```

### Root Cause

- Backend doesn't know about your new frontend URL
- `CLIENT_URL` on Render is wrong or not updated

### Solutions

**Step 1**: Update CLIENT_URL on Render

1. Go to Render dashboard → Your backend service
2. Click "Environment" tab
3. Find `CLIENT_URL` variable
4. Update the value to your exact Netlify frontend URL
5. Example: `https://ai-exam-monitor-123abc.netlify.app`
6. Click "Save Changes"

**Step 2**: Redeploy backend

1. Go to "Deployments" tab
2. Click the three dots ("...") on the latest deployment
3. Select "Redeploy"
4. Wait for "Live" status

**Step 3**: Hard refresh frontend

1. Go to your frontend URL
2. Hard refresh: `Ctrl+Shift+R`
3. Try the login again

**Step 4**: Check backend logs

1. Render → Logs
2. Should see console.log showing correct CLIENT_URL
3. If still wrong, Reload page in browser cache

---

## ISSUE 3: Firebase Initialization Error

### Symptoms

```
❌ Firebase initialization error: Invalid service account
```

In Render logs

### Root Cause

- One or more Firebase environment variables are wrong
- Private key is malformed
- Missing environment variables

### Solutions

**Step 1**: Verify all Firebase variables exist

1. Render → Environment tab
2. Check these variables are present:
   - FIREBASE_TYPE
   - FIREBASE_PROJECT_ID
   - FIREBASE_PRIVATE_KEY_ID
   - FIREBASE_PRIVATE_KEY
   - FIREBASE_CLIENT_EMAIL
   - FIREBASE_CLIENT_ID
   - FIREBASE_AUTH_URI
   - FIREBASE_TOKEN_URI
   - FIREBASE_AUTH_PROVIDER_X509_CERT_URL
   - FIREBASE_CLIENT_X509_CERT_URL
   - FIREBASE_UNIVERSE_DOMAIN

**Step 2**: Verify Firebase credentials format

1. Get fresh credentials from Firebase Console:
   - Go to [console.firebase.google.com](https://console.firebase.google.com)
   - Select your project
   - Settings (gear icon) → Project settings
   - Service Accounts tab
   - Click "Generate New Private Key"
   - A JSON file downloads

**Step 3**: Copy credentials correctly

1. Open the downloaded JSON file
2. For each field:
   - Copy the value
   - Paste into Render environment variable
   - **Important**: For `FIREBASE_PRIVATE_KEY`:
     - The value starts with `-----BEGIN PRIVATE KEY-----`
     - It has `\n` characters (NOT actual newlines)
     - It ends with `-----END PRIVATE KEY-----`
     - **Keep it as ONE long line with \n in it**

**Step 4**: Redeploy

1. Render → Deployments → Redeploy
2. Check logs for success message: `✅ Firebase Admin SDK initialized`

---

## ISSUE 4: Login Fails / User Not Created in Firestore

### Symptoms

- Click login, page loads but nothing happens
- No user in Firestore database
- Network shows error response from backend

### Root Cause

- Firebase not initialized (see ISSUE 3)
- No Firestore database created
- Backend error in authentication controller

### Solutions

**Step 1**: Check Firebase is initialized

1. Render → Logs
2. Should see: `✅ Firebase Admin SDK initialized`
3. If not, fix ISSUE 3 first

**Step 2**: Verify Firestore database exists

1. Firebase Console → Your project
2. Left sidebar → Firestore Database
3. If you see "Create database" button, click it
4. Start in "Test mode" for development
5. Choose region (e.g., `us-central1`)
6. Click "Create"

**Step 3**: Check backend logs for errors

1. Render → Logs
2. Look for error message from login attempt
3. Common errors:
   - "Collection not found" → Firestore not initialized
   - "Permission denied" → Database rules need updating
   - "Invalid JWT" → JWT_SECRET is different on Render

**Step 4**: Check network response

1. Frontend → DevTools → Network tab
2. Click the login POST request
3. Check Response tab for error message
4. Common responses:
   - 500 error → Backend error (check logs)
   - 401 error → Authentication failed
   - 400 error → Bad request (wrong password, etc.)

---

## ISSUE 5: Frontend Build Fails on Netlify

### Symptoms

```
failed during stage 'building site': Build script returned non-zero exit code: 1
```

### Root Cause

- Dependency installation failed
- Build command errored
- Missing environment variables

### Solutions

**Step 1**: Check Netlify build logs

1. Netlify → Deploys
2. Click on the failed deploy
3. Read the detailed log
4. Find the actual error message

**Step 2**: Common fixes

**If error is "Cannot find module...":**

- Clear build cache: Site settings → Build & deploy → Build cache → Clear cache
- Netlify auto-redeploy in ~1 minute

**If error is related to env variables:**

- Netlify → Site settings → Build & deploy → Environment
- Verify all VITE\_\* variables are present
- Redeploy

**If error is "npm ERR! code...":**

1. Check your package.json is valid JSON
2. Run locally: `npm install` in frontend directory
3. Fix any errors shown
4. Commit and push to GitHub
5. Netlify will auto-deploy

**Step 3**: Force rebuild

```
git commit --allow-empty -m "Rebuild"
git push origin main
```

Netlify will rebuild instantly.

---

## ISSUE 6: Render Backend Sleeping / Slow to Start

### Symptoms

- First API call takes 30+ seconds
- Error: "Service seems to be restarting..."

### Root Cause

- Free tier Render service spins down after 15 minutes of inactivity
- First request must spin it back up

### Solutions

**Option 1**: Upgrade to paid (not recommended for learning)

- Render → Settings → Change plan to Pro
- ~$7/month for always-on

**Option 2**: Live with cold starts (recommended for learning)

- This is normal on free tier
- Users shouldn't worry - just takes 30 sec on first request
- Subsequent requests are instant

**Option 3**: Keep backend warm (free hack, but not recommended)

- Use a cron job service to ping backend every 10 minutes
- Keeps it "warm" and prevents spin-down
- Use [cron-job.org](https://cron-job.org) (free tier available)

---

## ISSUE 7: Socket Connection / Real-time Features Not Working

### Symptoms

- Exam monitoring features don't update in real-time
- Console shows WebSocket error
- DevTools → Network → WS shows connection failed

### Root Cause

- Socket URL on frontend is wrong
- WebSocket not supported by firewall
- Backend Socket.io not initialized

### Solutions

**Step 1**: Check Socket URL on Netlify

1. Netlify → Site settings → Environment
2. Check `VITE_SOCKET_URL` = your backend URL (without /api)
3. Example: `https://your-backend.onrender.com`
4. Redeploy

**Step 2**: Check backend Socket setup

1. Go to backend/socket/examSocket.js
2. Verify Socket handlers are set up
3. Verify setupExamSocket is called in server.js

**Step 3**: Check browser capabilities

1. DevTools → Network
2. Filter for "WS" (WebSocket)
3. If no WS connection attempts, Socket not even trying
4. Check browser console for errors

**Step 4**: Try alternative transport

1. Edit frontend/src/hooks/useSocket.js:

```javascript
// Add 'polling' as fallback
transports: ['websocket', 'polling'],
```

2. Commit and push
3. Netlify will auto-deploy

---

## ISSUE 8: Firestore Rules Error

### Symptoms

```
Permission denied when reading from Firestore
```

Or: Cannot access Firestore collections

### Root Cause

- Firestore security rules too restrictive
- Started in production mode (locked down)

### Solutions

**For Development (Allow all access):**

1. Firebase Console → Your project
2. Firestore Database → Rules tab
3. Replace everything with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

4. Click "Publish"

**For Production (Restrict access):**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users collection
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }

    // Exams collection
    match /exams/{examId} {
      allow read: if request.auth != null;
      allow write: if request.auth.token.role == 'faculty';
    }

    // Submissions collection
    match /submissions/{submissionId} {
      allow read, write: if request.auth.uid == resource.data.studentId;
    }
  }
}
```

---

## ISSUE 9: Environment Variables Not Loading

### Symptoms

- API calls to localhost even on production
- Backend shows empty env variables
- Frontend showing hardcoded values

### Root Cause

- Build doesn't include env variables
- Variables added after build was triggered
- Typo in variable name

### Solutions

**Step 1**: Verify variable names are exactly right

- On Render/Netlify: Go to Environment settings
- Check spelling: `VITE_API_URL` NOT `API_URL`
- Frontend variables must start with `VITE_`

**Step 2**: Clear build cache and rebuild

- **Netlify**: Site settings → Build cache → Clear cache
- **Render**: Deployments → Redeploy
- Wait 2-5 minutes for rebuild

**Step 3**: Verify variables in build output

- Netlify: Check Deploy log for env var section
- Render: Logs should show environment variables

---

## ISSUE 10: PaymentMethod Required on Render

### Symptoms

```
Error: Payment method required to continue
```

### Root Cause

- Free tier resources were exceeded
- Or service scaled beyond free tier

### Solutions

- Update payment method OR
- Delete service and recreate OR
- Switch to Netlify (frontend only)

---

## Getting Help

If issue not listed above:

1. **Check Render Logs** (Backend):
   - Render → Service → Logs tab
   - Read last 50 lines carefully

2. **Check Netlify Logs** (Frontend):
   - Netlify → Deploys → Latest deploy
   - Click "Deploy log" for details

3. **Check Browser Console** (Frontend):
   - DevTools → Console tab
   - Look for red error messages
   - Copy full error text

4. **Check Network Requests** (Frontend):
   - DevTools → Network tab
   - Click failed request
   - Check Response tab for error details

5. **Check Firebase Console**:
   - Firestore Database → Check collections exist
   - Authentication → Check users are created
   - Rules → Check if too restrictive

---

## Still Stuck?

Double-check the DEPLOYMENT_GUIDE.md step 1-5 were completed correctly.

Most issues come from:

1. ❌ Typo in environment variable
2. ❌ Wrong URL copied
3. ❌ Firebase private key malformed
4. ❌ Not redeploying after env changes
5. ❌ Using http:// instead of https://
