# 🚀 Complete Deployment Guide: Render (Backend) + Netlify (Frontend)

> **Total Deployment Time**: 20-30 minutes. Follow all steps in order.

---

## 📋 Pre-Deployment Checklist

- [ ] GitHub account created
- [ ] Render account created (render.com) → free tier
- [ ] Netlify account created (netlify.com) → free tier
- [ ] Firebase Project created and service account JSON ready
- [ ] All code changes applied from this guide

---

## STEP 1️⃣: Push Project to GitHub

### 1.1. Create GitHub Repository

1. Go to [github.com/new](https://github.com/new)
2. Repository name: `ai-exam-monitor`
3. Choose **Private** (to hide your Firebase credentials)
4. Click "Create repository"

### 1.2. Initialize Git & Push Code

**On Windows PowerShell in your project root:**

```powershell
# Initialize git (if not already done)
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: AI Exam Monitor with Firebase"

# Add remote repository
git remote add origin https://github.com/YOUR_USERNAME/ai-exam-monitor.git

# Push to main branch
git branch -M main
git push -u origin main
```

**You'll be prompted for:** GitHub username and Personal Access Token

- Go to [github.com/settings/tokens](https://github.com/settings/tokens)
- Generate new token with `repo` permission
- Copy and paste it when prompted

✅ **Verify**: Check your GitHub repo shows all files

---

## STEP 2️⃣: Deploy Backend to Render

### 2.1. Create Render Web Service

1. Go to [render.com](https://render.com)
2. Sign up (free) → Connect GitHub
3. Click **"New +"** → Select **"Web Service"**
4. Connect Repository:
   - Select your `ai-exam-monitor` repository
   - Root Directory: `backend`
   - Runtime: Node
5. Click "Create Web Service"

### 2.2. Configure Environment Variables on Render

**After service creation, go to "Environment" tab:**

Add these environment variables: (Copy from your `backend/.env`)

```
NODE_ENV=production
CLIENT_URL=https://your-netlify-domain.netlify.app
JWT_SECRET=your_super_secret_jwt_key_minimum_32_chars_long_change_this_now

FIREBASE_TYPE=service_account
FIREBASE_PROJECT_ID=ai--exam-5c49e
FIREBASE_PRIVATE_KEY_ID=155fbd6a412ec1925b23163e9bf6f92d00bebee5
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDCplpQqTiHlok8\n....[FULL KEY].....-----END PRIVATE KEY-----\n
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@ai--exam-5c49e.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=103815560035432627527
FIREBASE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token
FIREBASE_AUTH_PROVIDER_X509_CERT_URL=https://www.googleapis.com/oauth2/v1/certs
FIREBASE_CLIENT_X509_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40ai--exam-5c49e.iam.gserviceaccount.com
FIREBASE_UNIVERSE_DOMAIN=googleapis.com
```

⚠️ **Important**: When copying `FIREBASE_PRIVATE_KEY`, keep all `\n` as they are (don't convert to actual newlines)

### 2.3. Configure Build & Start Commands

Go to **"Settings"** tab:

- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Node Version**: `18` (or latest)

### 2.4. Wait for Deployment

- Render will automatically deploy
- Watch the logs for any errors
- When you see `✅ Firebase Admin SDK initialized` → Backend is ready!
- Copy your **backend URL** (e.g., `https://ai-exam-monitor-backend.onrender.com`)

✅ **Test**: Visit `https://your-backend-url.onrender.com/api/health`
You should see: `{"status":"OK","timestamp":"..."}`

---

## STEP 3️⃣: Configure Frontend for Netlify

### 3.1. Update Frontend Environment Variables

Create/update `frontend/.env.production`:

```env
VITE_API_URL=https://ai-exam-monitor-backend.onrender.com/api
VITE_SOCKET_URL=https://ai-exam-monitor-backend.onrender.com

VITE_FIREBASE_API_KEY=AIzaSyB-267l-OEkHj_iGQXB3XIeJ6mimzWIgjQ
VITE_FIREBASE_AUTH_DOMAIN=ai--exam-5c49e.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=ai--exam-5c49e
VITE_FIREBASE_STORAGE_BUCKET=ai--exam-5c49e.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=232210611462
VITE_FIREBASE_APP_ID=1:232210611462:web:826d73751617716c0a3287
```

### 3.2. Update `frontend/vite.config.js`

Make sure it has:

```javascript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    sourcemap: false,
    minify: "terser",
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
});
```

### 3.3. Push Changes to GitHub

```powershell
cd frontend
git add .
git commit -m "Add Netlify configuration and production env variables"
git push origin main
```

---

## STEP 4️⃣: Deploy Frontend to Netlify

### 4.1. Create Netlify Site

1. Go to [netlify.com](https://netlify.com)
2. Sign up (free) → Connect GitHub
3. Click **"Add new site"** → **"Import an existing project"**
4. Select your `ai-exam-monitor` repository
5. Configuration:
   - **Base directory**: `frontend`
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
6. Click "Deploy site"

### 4.2. Add Environment Variables on Netlify

Go to **Site settings** → **Build & deploy** → **Environment**

Add variables:

```
VITE_API_URL=https://ai-exam-monitor-backend.onrender.com/api
VITE_SOCKET_URL=https://ai-exam-monitor-backend.onrender.com

VITE_FIREBASE_API_KEY=AIzaSyB-267l-OEkHj_iGQXB3XIeJ6mimzWIgjQ
VITE_FIREBASE_AUTH_DOMAIN=ai--exam-5c49e.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=ai--exam-5c49e
VITE_FIREBASE_STORAGE_BUCKET=ai--exam-5c49e.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=232210611462
VITE_FIREBASE_APP_ID=1:232210611462:web:826d73751617716c0a3287
```

### 4.3. Wait for Deployment

- Netlify will build & deploy automatically
- When build is complete, you'll get a deploy preview URL
- Copy your **frontend URL** (e.g., `https://your-site.netlify.app`)

✅ **Test**: Visit your Netlify frontend URL - you should see the app!

---

## STEP 5️⃣: Update Backend CORS for Frontend URL

### 5.1. Update Render Environment Variable

Go back to Render backend service → **Environment** tab

Update **CLIENT_URL**:

```
CLIENT_URL=https://your-netlify-site.netlify.app
```

This gives backend permission to accept requests from your new frontend URL.

### 5.2. Manual Redeploy

Go to **Deployments** tab → Click the "..." menu → **"Redeploy"**

Wait for deployment to complete. Now CORS should be fixed!

---

## STEP 6️⃣: Test Backend-Frontend Connection

### 6.1. Test API Connection

1. Open your Netlify frontend URL
2. Open **Browser DevTools** → **Network** tab
3. Try logging in
4. Watch the network requests
5. You should see requests like: `https://ai-exam-monitor-backend.onrender.com/api/auth/login`

### 6.2. Check Console for Errors

In DevTools **Console** tab:

- Should see NO CORS errors
- Should see successful API responses
- If you see errors, check step 5.1 again

### 6.3. Verify Database Connection

If login works:

1. User data should appear in Firestore (Firebase Console)
2. No "Firebase initialization error" in Render logs

---

## 🔧 If Something Goes Wrong...

### ❌ Frontend Shows "Cannot reach backend"

**Solution**:

1. Check Render backend URL is correct in frontend `.env`
2. Visit backend health endpoint directly: `https://your-backend.onrender.com/api/health`
3. If 404, backend isn't deployed. Check Render logs.

### ❌ CORS Error in Browser Console

**Solution**:

1. Backend's `CLIENT_URL` must match your exact Netlify URL
2. Go to Render → Environment → Update `CLIENT_URL`
3. Redeploy backend
4. Refresh frontend (hard refresh: `Ctrl+Shift+R`)

### ❌ Firebase Connection Error

**Solution**:

1. Check all `FIREBASE_*` env vars on Render are correct
2. Copy each line EXACTLY from your `backend/.env`
3. Special attention to `FIREBASE_PRIVATE_KEY` - keep all `\n`
4. Redeploy and check logs

### ❌ Login Not Working

**Solution**:

1. Check `JWT_SECRET` is set on Render
2. Verify Firestore database has collections (check Firebase Console)
3. Check browser Network tab → see if login request returns error
4. If yes, check Render backend logs for error message

### ❌ Netlify Build Failing

**Solution**:

1. Go to Netlify → **Deploys** → **Deploy log**
2. Read the error message
3. Common issue: `npm install` failed → Clear cache & redeploy
4. Go to **Site settings** → **Build & deploy** → **Build cache** → **Clear cache**

---

## 📊 Monitoring & Logs

### View Backend Logs (Render)

Render → Logs tab → See all API requests & errors in real-time

### View Frontend Logs (Netlify)

Browser DevTools Console while using the app

### View Database (Firebase Console)

[Firebase Console](https://console.firebase.google.com/) → Your project → Firestore Database → See all collections & documents

---

## 🔐 Security Checklist

- [ ] Backend repository is **Private** on GitHub
- [ ] `.env` files in `.gitignore` (never committed)
- [ ] `firebase-service-account.json` in `.gitignore`
- [ ] All sensitive data in Render environment variables (NOT in code)
- [ ] `JWT_SECRET` is long & random (at least 32 characters)
- [ ] Render & Netlify URLs are only accessible via HTTPS

---

## 🎯 What to Do Next

### For Adding New Features:

1. Make code changes locally
2. Test on `localhost` with `npm run dev` (both frontend & backend)
3. Commit & push to GitHub
4. Render & Netlify auto-deploy on push

### For Configuration Changes:

1. Update environment variables on Render/Netlify
2. Redeploy manually
3. No need to push code changes

### For Database Changes:

1. All data changes visible in Firebase Console
2. Firestore auto-syncs with your app

---

## 📞 Common Questions

**Q: Why is my backend sleeping?**
A: Render free tier sleeps after 15 min inactivity. First request takes 30sec. Upgrade to paid tier for always-on.

**Q: Can I use my own domain?**
A: Yes! Netlify & Render support custom domains. Go to Settings → Domain management.

**Q: How much does this cost?**
A: Everything is **FREE** on free tier. Render may charge if backend gets lots of traffic.

**Q: How do I update my code in production?**
A: Just push to GitHub. Render & Netlify auto-deploy within minutes.

---

✅ **Congratulations!** Your app is now live online! 🎉

For support, check deployment platform docs or see logs.
