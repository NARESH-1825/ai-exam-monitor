# 🎓 AI Exam Monitor - Complete Deployment Guide

> **Your complete guide to hosting the AI Exam Monitor project on Render (backend) + Netlify (frontend)**

---

## 📖 Documentation Structure

This project includes comprehensive guides for every step of deployment:

| Document                                             | Purpose                           | When to Use                            |
| ---------------------------------------------------- | --------------------------------- | -------------------------------------- |
| **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)**       | 📋 Main deployment steps          | **START HERE** for full step-by-step   |
| **[LOCAL_TESTING_GUIDE.md](LOCAL_TESTING_GUIDE.md)** | 🧪 Test locally before deployment | Before pushing to GitHub               |
| **[FIREBASE_SETUP.md](FIREBASE_SETUP.md)**           | 🔥 Firebase configuration         | Set up Firebase (do BEFORE deployment) |
| **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)**         | 🔧 Fix deployment issues          | When something goes wrong              |
| **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)**         | ⚡ URLs, commands, checklists     | Quick lookup during deployment         |

---

## ⚡ Quick Start (TL;DR)

**Total time: ~30 minutes**

### Prerequisites

- GitHub account
- Render account (render.com) - free
- Netlify account (netlify.com) - free
- Firebase project created (Firebase Console)

### Steps

1. **Get Firebase Credentials** [FIREBASE_SETUP.md](FIREBASE_SETUP.md)
   - Service Account from Firebase Console
   - Copy 11 environment variables

2. **Test Locally** [LOCAL_TESTING_GUIDE.md](LOCAL_TESTING_GUIDE.md)

   ```powershell
   # Terminal 1
   cd backend && npm install && npm run dev

   # Terminal 2
   cd frontend && npm install && npm run dev
   ```

   - Try login at http://localhost:5173
   - Verify no errors in console/logs

3. **Push to GitHub** [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md#step-1️⃣-push-project-to-github)

   ```powershell
   git add . && git commit -m "Initial" && git push origin main
   ```

4. **Deploy Backend to Render** [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md#step-2️⃣-deploy-backend-to-render)
   - Create Web Service in Render
   - Add Firebase env variables
   - Wait for deployment (shows "Live")
   - Copy backend URL

5. **Deploy Frontend to Netlify** [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md#step-4️⃣-deploy-frontend-to-netlify)
   - Create Site in Netlify
   - Set frontend env variables with backend URL
   - Wait for deployment
   - Copy frontend URL

6. **Connect Frontend & Backend** [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md#step-5️⃣-update-backend-cors-for-frontend-url)
   - Update Render's `CLIENT_URL` with Netlify URL
   - Redeploy backend
   - Test login on production

7. **Validate** [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md#step-6️⃣-test-backend-frontend-connection)
   - Visit your frontend URL
   - Try logging in
   - Check Firestore database

---

## 🆘 Troubleshooting

Got an error? Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for:

- ❌ Cannot reach backend
- ❌ CORS errors
- ❌ Firebase errors
- ❌ Build failures
- ❌ And 6 more common issues with solutions

---

## 📚 Full Guides

### For First-Time Setup

**[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** (Recommended - start here!)

- Step-by-step instructions
- Screenshots/detailed explanations
- For users who've never deployed before

### For Technical Details

**[FIREBASE_SETUP.md](FIREBASE_SETUP.md)**

- Firebase project setup
- Firestore collections structure
- Security rules (dev vs prod)
- Billing information

### For Local Development

**[LOCAL_TESTING_GUIDE.md](LOCAL_TESTING_GUIDE.md)**

- Start backend & frontend locally
- Test authentication
- Verify Firebase connection
- Common local issues

### For Reference During Deployment

**[QUICK_REFERENCE.md](QUICK_REFERENCE.md)**

- All important URLs
- Environment variables checklist
- Terminal commands
- Deployment checklist
- Print this out or keep open!

### For Problem Solving

**[TROUBLESHOOTING.md](TROUBLESHOOTING.md)**

- 10 most common issues
- Clear solutions for each
- How to read error logs
- Getting help resources

---

## 🎯 What This Project Contains

### Backend (Node.js + Express)

- ✅ Firebase Admin SDK (authentication & database)
- ✅ JWT token handling
- ✅ Exam management endpoints
- ✅ Student submission tracking
- ✅ Proctor monitoring via WebSocket
- ✅ Rate limiting & security

### Frontend (React + Vite)

- ✅ Login/Authentication
- ✅ Dashboard for students & faculty
- ✅ Exam creation & configuration
- ✅ Live exam monitoring
- ✅ Real-time proctoring features
- ✅ Firestore integration

### Database (Firestore)

- ✅ Cloud-hosted (no server maintenance)
- ✅ Real-time sync capability
- ✅ Built-in authentication
- ✅ Scalable to millions of students

---

## 💰 Cost Breakdown

### Hosting

| Service              | Free Tier                      | Cost               |
| -------------------- | ------------------------------ | ------------------ |
| **Render Backend**   | Up to 750 compute hours/month  | $0 (within limits) |
| **Netlify Frontend** | Unlimited bandwidth            | $0                 |
| **Firebase**         | 1GB storage + 50k reads/day    | $0 (within limits) |
| **GitHub**           | Unlimited public/private repos | $0                 |
| **Total**            | Everything                     | **$0** ✅          |

**For production use**, expect minimal costs unless you exceed free tier limits (rare for small deployments).

---

## 🚀 Deployment Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Your Users                            │
└─────────────┬──────────────────────────────┬─────────────┘
              │                              │
              ↓ (HTTPS)                      ↓ (HTTPS)
    ┌─────────────────┐           ┌──────────────────────┐
    │    Netlify      │           │      Render          │
    │   (Frontend)    │◄─────────►│     (Backend)        │
    │  React + Vite   │  REST API │  Node + Express      │
    │   Dist folder   │  WebSocket│  Port 10000          │
    └─────────────────┘           └──────────┬───────────┘
                                             │
                                             ↓
                                ┌────────────────────────┐
                                │     Firebase          │
                                │   (Authentication &   │
                                │    Firestore DB)      │
                                └────────────────────────┘
```

---

## ✅ Pre-Deployment Checklist

- [ ] GitHub account created
- [ ] All code tested locally
- [ ] Firebase project created
- [ ] Firebase service account credentials ready
- [ ] .gitignore updated (never commit .env!)
- [ ] Node.js v18+ installed
- [ ] Understand basic git commands

---

## 🎓 Learning Path

### Beginner?

1. Read this README
2. Follow [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) step-by-step
3. Use [QUICK_REFERENCE.md](QUICK_REFERENCE.md) for commands

### Experienced?

1. Check [QUICK_REFERENCE.md](QUICK_REFERENCE.md)
2. Skip to [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md#step-3️⃣-configure-frontend-for-netlify)
3. Reference [TROUBLESHOOTING.md](TROUBLESHOOTING.md) as needed

### Advanced?

1. Use [FIREBASE_SETUP.md](FIREBASE_SETUP.md) for security rules
2. Customize [render.yaml](render.yaml) for your needs
3. Set up custom domains in Render/Netlify settings

---

## 📞 Support & Resources

### Official Documentation

- [Render Docs](https://render.com/docs)
- [Netlify Docs](https://docs.netlify.com)
- [Firebase Docs](https://firebase.google.com/docs)
- [Express.js Docs](https://expressjs.com)
- [React Docs](https://react.dev)

### Community Help

- Stack Overflow: Search error message
- GitHub Issues: Create issue in this repo
- Firebase Console: Check logs & metrics

### Common Search Terms

- `"Your error message" site:stackoverflow.com`
- `Node.js Firebase deployment`
- `React Vite Netlify deployment`
- `CORS error fix`

---

## 🔐 Security Reminders

⚠️ **CRITICAL**

- Never commit `.env` files
- Never share private keys
- Keep `firebase-service-account.json` in `.gitignore`
- Use HTTPS in production (Render & Netlify do this)
- Update Firestore security rules before going live

✅ **Best Practices** implemented:

- Environment variables for all secrets
- JWT token rotation
- Rate limiting on API endpoints
- CORS protection
- Helmet security headers
- Firebase security rules

---

## 📈 After Deployment

### Your app is live! Now what?

1. **Share the URL** with students/faculty
2. **Monitor usage** in Firebase Console
3. **Check logs** regularly for errors
4. **Update code** by pushing to GitHub (auto-deploy)
5. **Scale** if needed (upgrade Render plan)

---

## 🔄 Continuous Deployment

After first deployment:

```
1. Make code changes locally
   ↓
2. git add . && git commit && git push origin main
   ↓
3. Render/Netlify auto-detect changes
   ↓
4. Automatic redeploy (1-2 minutes)
   ↓
5. Your changes are LIVE ✅
```

No manual deployment needed!

---

## 🎉 Success Indicators

Your deployment is successful when:

✅ Frontend URL loads at `https://your-site.netlify.app`  
✅ Can log in with email/password  
✅ New user appears in Firebase Authentication  
✅ User data saved in Firestore collections  
✅ No CORS errors in browser console  
✅ Backend health check: `https://your-backend.onrender.com/api/health` returns OK  
✅ All app features work (exams, monitoring, etc.)  
✅ Real-time updates work instantly

---

## 📝 File Structure

```
project/
├── backend/
│   ├── .env                    ← Local env (never commit)
│   ├── .env.production         ← Template for production
│   ├── package.json
│   ├── server.js
│   ├── config/
│   │   ├── firebase.js        ← ✅ Updated for env vars
│   │   └── db.js
│   ├── routes/
│   ├── controllers/
│   └── middleware/
├── frontend/
│   ├── .env                   ← Local env
│   ├── .env.production        ← Production template
│   ├── package.json
│   ├── vite.config.js
│   ├── netlify.toml           ← ✅ Netlify config
│   ├── src/
│   │   ├── services/api.js   ← ✅ Updated for env URLs
│   │   └── ...
├── render.yaml                 ← ✅ Render deployment config
├── .gitignore                  ← ✅ Security config
├── DEPLOYMENT_GUIDE.md         ← 📋 Main guide
├── LOCAL_TESTING_GUIDE.md      ← 🧪 Testing guide
├── FIREBASE_SETUP.md           ← 🔥 Firebase guide
├── TROUBLESHOOTING.md          ← 🔧 Problem solving
├── QUICK_REFERENCE.md          ← ⚡ Quick reference
└── DEPLOYMENT_README.md        ← 📚 This file
```

---

## 🎊 Getting Started Right Now!

### Next Step: Read [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)

That file contains everything you need. Follow it step-by-step and you'll be live in 30 minutes!

---

## 📋 Change Summary

Recent updates for deployment:

- ✅ Updated `backend/server.js` for production (CORS, listening on 0.0.0.0)
- ✅ Updated `backend/config/firebase.js` to use environment variables
- ✅ Updated `frontend/src/services/api.js` with production URL support
- ✅ Created `render.yaml` for automated Render deployment
- ✅ Created `frontend/netlify.toml` for Netlify deployment
- ✅ Created `.env.production` templates for both frontend & backend
- ✅ Updated `.gitignore` for security

---

**Ready to deploy? Let's go! 🚀**

**👉 [Start with DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)**

---

_Last Updated: 2026-03-08_
_Version: 1.0_
