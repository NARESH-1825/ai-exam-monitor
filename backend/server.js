const express      = require('express');
const http         = require('http');
const { Server }   = require('socket.io');
const cors         = require('cors');
const helmet       = require('helmet');
const morgan       = require('morgan');
const cookieParser = require('cookie-parser');
const { initFirebase }   = require('./config/firebase');
const { setupExamSocket } = require('./socket/examSocket');
require('dotenv').config();

const app    = express();
const server = http.createServer(app);

// ──────────────────────────────────────────────
//  CORS — origin list (no paths, no slashes)
// ──────────────────────────────────────────────
const allowedOrigins = [
  process.env.CLIENT_URL,       // set this on Render!
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
]
  .filter(Boolean)
  .map(o => o.replace(/\/$/, '')); // strip accidental trailing slashes

const corsOptions = {
  origin(origin, cb) {
    // no origin = Postman / curl / server-to-server — always allow
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    console.warn(`[CORS] Blocked: ${origin}`);
    cb(new Error(`Origin not allowed: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// ──────────────────────────────────────────────
//  Socket.io
// ──────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: allowedOrigins, credentials: true },
});

initFirebase();
app.use(helmet({ contentSecurityPolicy: false }));

// ▼▼▼ THESE TWO LINES ARE THE CRITICAL FIX ▼▼▼
app.options('*', cors(corsOptions)); // handle preflight for ALL routes
app.use(cors(corsOptions));          // apply CORS to all responses
// ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(morgan('dev'));

app.use('/api/auth',    require('./routes/auth'));
app.use('/api/student', require('./routes/student'));
app.use('/api/faculty', require('./routes/faculty'));
app.use('/api/exam',    require('./routes/exam'));
app.use('/api/monitor', require('./routes/monitor'));

app.get('/api/health', (_req, res) =>
  res.json({ status: 'OK', timestamp: new Date(), allowedOrigins })
);

setupExamSocket(io);

app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ message: err.message });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Port ${PORT} | Allowed Origins:\n  ${allowedOrigins.join('\n  ')}`);
});
module.exports = { io };