# 📚 Quick Reference: Deployment URLs & Commands

Keep this file for quick reference during and after deployment.

---

## During Deployment - Important URLs

### GitHub
- Repository: `https://github.com/YOUR_USERNAME/ai-exam-monitor`
- Settings: `https://github.com/YOUR_USERNAME/ai-exam-monitor/settings`

### Firebase
- Console: `https://console.firebase.google.com` → Select project "ai--exam-5c49e"
- Firestore Database: `https://console.firebase.google.com/project/ai--exam-5c49e/firestore`
- Authentication: `https://console.firebase.google.com/project/ai--exam-5c49e/authentication`
- Service Accounts: `https://console.firebase.google.com/project/ai--exam-5c49e/settings/serviceaccounts`

### Render (Backend)
- Dashboard: `https://render.com/dashboard`
- Services: `https://render.com/dashboard/services`
- After deployment: `https://ai-exam-monitor-backend.onrender.com`
- Health check: `https://ai-exam-monitor-backend.onrender.com/api/health`

### Netlify (Frontend)
- Dashboard: `https://app.netlify.com`
- Sites: `https://app.netlify.com/sites`
- After deployment: `https://YOUR-SITE-NAME.netlify.app`

---

## Environment Variables Checklist

### Backend (.env for local, set on Render)

- [ ] `NODE_ENV=production`
- [ ] `PORT=10000` (Render)
- [ ] `CLIENT_URL=` (Netlify frontend URL, update ASAP)
- [ ] `JWT_SECRET=` (min 32 chars, change from default!)
- [ ] `FIREBASE_TYPE=service_account`
- [ ] `FIREBASE_PROJECT_ID=ai--exam-5c49e`
- [ ] `FIREBASE_PRIVATE_KEY_ID=`
- [ ] `FIREBASE_PRIVATE_KEY=` (keep \n characters!)
- [ ] `FIREBASE_CLIENT_EMAIL=`
- [ ] `FIREBASE_CLIENT_ID=`
- [ ] `FIREBASE_AUTH_URI=https://accounts.google.com/o/oauth2/auth`
- [ ] `FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token`
- [ ] `FIREBASE_AUTH_PROVIDER_X509_CERT_URL=https://www.googleapis.com/oauth2/v1/certs`
- [ ] `FIREBASE_CLIENT_X509_CERT_URL=`
- [ ] `FIREBASE_UNIVERSE_DOMAIN=googleapis.com`

### Frontend (.env for local, set on Netlify)

- [ ] `VITE_API_URL=` (Render backend URL/api)
- [ ] `VITE_SOCKET_URL=` (Render backend URL without /api)
- [ ] `VITE_FIREBASE_API_KEY=AIzaSyB-267l-OEkHj_iGQXB3XIeJ6mimzWIgjQ`
- [ ] `VITE_FIREBASE_AUTH_DOMAIN=ai--exam-5c49e.firebaseapp.com`
- [ ] `VITE_FIREBASE_PROJECT_ID=ai--exam-5c49e`
- [ ] `VITE_FIREBASE_STORAGE_BUCKET=ai--exam-5c49e.firebasestorage.app`
- [ ] `VITE_FIREBASE_MESSAGING_SENDER_ID=232210611462`
- [ ] `VITE_FIREBASE_APP_ID=1:232210611462:web:826d73751617716c0a3287`

---

## Terminal Commands Quick Ref

### Git Commands
```powershell
# First time setup
git init
git remote add origin https://github.com/YOUR_USERNAME/ai-exam-monitor.git

# Making changes
git add .
git commit -m "Your message"
git push origin main

# Pull latest from GitHub
git pull origin main

# Check status
git status
```

### Local Development
```powershell
# Terminal 1 - Backend
cd backend
npm install
npm run dev

# Terminal 2 - Frontend
cd frontend
npm install
npm run dev

# Visit http://localhost:5173
```

### Production Commands
```powershell
# Render auto-runs these:
npm install          # from backend/package.json
npm start            # starts backend/server.js

# Netlify auto-runs these:
npm run build        # from frontend/package.json
# Then serves dist/ folder
```

---

## Deployment Checklist

### Before Pushing to GitHub
- [ ] All `.env` files configured locally
- [ ] Backend works locally: `npm run dev`
- [ ] Frontend works locally: `npm run dev`
- [ ] Can login successfully
- [ ] No authentication errors
- [ ] Check `.gitignore` includes `.env` and `node_modules/`

### Before Deploying to Render
- [ ] GitHub repo created and code pushed
- [ ] Render account created
- [ ] All FIREBASE_* vars ready from service account JSON
- [ ] JWT_SECRET generated (at least 32 random characters)

### After Deploying to Render
- [ ] Backend deployment shows "Live" (green)
- [ ] Health endpoint works: `https://your-backend.onrender.com/api/health`
- [ ] Firebase initialized: check logs for ✅
- [ ] Copy backend URL for frontend config

### Before Deploying to Netlify
- [ ] Netlify account created
- [ ] Backend is live and has a working URL
- [ ] Frontend `.env.production` updated with backend URL
- [ ] All `VITE_*` environment variables copied

### After Deploying to Netlify
- [ ] Frontend deployment shows green checkmark
- [ ] Frontend loads without errors
- [ ] Can see the login page
- [ ] No CORS errors in DevTools console

### Final Validation
- [ ] Try logging in on production
- [ ] Check Firestore database for new user
- [ ] Monitor functions work (if implemented)
- [ ] Check Render logs for errors
- [ ] Check Netlify deploy log for warnings

---

## Step-by-Step Deployment Summary

1. **Local Testing** (20 min)
   - Backend: `npm run dev` ✓
   - Frontend: `npm run dev` ✓
   - Login test ✓

2. **GitHub** (5 min)
   - `git add .`
   - `git commit -m "Initial commit"`
   - `git push origin main` ✓

3. **Render Backend** (10 min)
   - Create Web Service
   - Connect GitHub repo
   - Set ALL env variables
   - Wait for deployment
   - Test `/api/health` ✓

4. **Update Frontend Config** (2 min)
   - Add backend URL to frontend env
   - `git push origin main` ✓

5. **Netlify Frontend** (10 min)
   - Create Site
   - Connect GitHub repo
   - Set env variables
   - Wait for deployment ✓

6. **Connect Backend & Frontend** (5 min)
   - Update Render `CLIENT_URL` with Netlify URL
   - Redeploy Render
   - Test frontend API calls ✓

---

## If Deployment Fails

### Step 1: Check Deployment Logs
- **Render**: Service → Logs tab
- **Netlify**: Deploys → Deploy log

### Step 2: Search for Error
- Copy error message from logs
- Search in TROUBLESHOOTING.md
- Or search error on Google

### Step 3: Fix Issue Locally
- Update code
- Test locally: `npm run dev`
- Commit: `git push origin main`
- Render/Netlify auto-redeploy

### Step 4: Manual Redeploy (if auto-deploy fails)
- **Render**: Deployments → "..." → Redeploy
- **Netlify**: Deploys → Trigger deploy → "Deploy site"

---

## Common Error Messages & Solutions

| Error | Solution |
|-------|----------|
| `Cannot reach backend` | Update `VITE_API_URL` on Netlify, redeploy |
| `CORS error` | Update `CLIENT_URL` on Render, redeploy |
| `Firebase initialization error` | Check `FIREBASE_*` vars on Render |
| `Permission denied (Firestore)` | Update security rules to Test Mode |
| `Build failed (Netlify)` | Check build log, clear cache, redeploy |
| `Port already in use (local)` | Kill process: `netstat -ano \| findstr :5000` |

---

## Support Resources

| Issue | Resource |
|-------|----------|
| Render errors | Check service logs, visit [render.com/docs](https://render.com/docs) |
| Netlify errors | Check deploy log, visit [netlify.com/docs](https://docs.netlify.com) |
| Firebase errors | Check Firebase Console, visit [firebase.google.com/docs](https://firebase.google.com/docs) |
| General Node/React | Google the error message + "stackoverflow" |

---

## Production Monitoring

### Weekly Checks
- [ ] Render logs for errors
- [ ] Netlify deploy status
- [ ] Firebase usage (stay under free tier limits)
- [ ] User feedback on app performance

### If Backend Gets Slow
- Upgrade Render plan (cost ~$7/month)
- Or optimize database queries

### If Storage Gets Full
- Check Firebase usage: Console → Usage & billing
- Delete old submissions if needed
- Or upgrade to Blaze plan

---

## Maintenance

### To Deploy New Code
```powershell
# Make changes locally
# Test locally: npm run dev

# Push to GitHub (auto-deploy)
git add .
git commit -m "Your changes"
git push origin main

# Watch deployments
# Render auto-redeploy in 1-2 minutes
# Netlify auto-redeploy in 1-2 minutes
```

### To Update Environment Variables
- **Render**: Service → Environment → Save → Redeploy
- **Netlify**: Site settings → Environment → Trigger redeploy

### To Update Firestore Rules
- Firebase Console → Firestore → Rules → Publish

---

## When Everything Works! 🎉

Your deployment is successful when:

✅ Frontend URL loads without errors  
✅ Can login with email/password  
✅ User is created in Firestore  
✅ No CORS errors in console  
✅ Backend health endpoint shows OK  
✅ All pages load and functions work  
✅ Can create exams (faculty users)  
✅ Can take exams (student users)  
✅ Real-time updates work (if WebSocket implemented)  

---

## Next Steps

1. Share frontend URL with users
2. Invite faculty to create exams
3. Add students to exams
4. Monitor exam sessions
5. Track performance in Firebase Console

---

**Happy Deploying! 🚀**

