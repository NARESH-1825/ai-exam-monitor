#!/bin/bash
echo "🔥 AI Exam Monitor (Firebase Edition) — Setup"
echo "============================================="
echo ""

echo "📦 Installing backend dependencies..."
cd backend && npm install
if [ $? -ne 0 ]; then echo "❌ Backend install failed"; exit 1; fi
echo "✅ Backend ready"

echo ""
echo "📦 Installing frontend dependencies..."
cd ../frontend && npm install
if [ $? -ne 0 ]; then echo "❌ Frontend install failed"; exit 1; fi
echo "✅ Frontend ready"

echo ""
echo "════════════════════════════════════════════"
echo "✅ Setup complete! Before running:"
echo ""
echo "  1. Download Firebase service account:"
echo "     Firebase Console → Project Settings → Service Accounts"
echo "     → Generate new private key"
echo "     → Save as: backend/firebase-service-account.json"
echo ""
echo "  2. Set up Firestore (see FIRESTORE_SETUP.md)"
echo ""
echo "  3. Start the app:"
echo "     Terminal 1: cd backend && npm run dev"
echo "     Terminal 2: cd frontend && npm run dev"
echo ""
echo "  4. Open: http://localhost:5173"
echo "════════════════════════════════════════════"
