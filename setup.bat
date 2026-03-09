@echo off
echo 🔥 AI Exam Monitor (Firebase Edition) - Setup
echo =============================================
echo.
echo 📦 Installing backend dependencies...
cd backend
call npm install
if errorlevel 1 (echo ❌ Backend install failed & exit /b 1)
echo ✅ Backend ready

echo.
echo 📦 Installing frontend dependencies...
cd ..\frontend
call npm install
if errorlevel 1 (echo ❌ Frontend install failed & exit /b 1)
echo ✅ Frontend ready

echo.
echo ============================================
echo ✅ Setup complete! Before running:
echo.
echo   1. Download Firebase service account:
echo      Firebase Console - Project Settings - Service Accounts
echo      - Generate new private key
echo      - Save as: backend\firebase-service-account.json
echo.
echo   2. See FIRESTORE_SETUP.md for full guide
echo.
echo   3. Start the app:
echo      Terminal 1: cd backend ^&^& npm run dev
echo      Terminal 2: cd frontend ^&^& npm run dev
echo.
echo   4. Open: http://localhost:5173
echo ============================================
pause
