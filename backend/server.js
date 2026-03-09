// backend/server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const { initFirebase } = require("./config/firebase");
const { setupExamSocket } = require("./socket/examSocket");
require("dotenv").config();

const app = express();
const server = http.createServer(app);

// Socket.io with CORS - Support both local and production URLs
const allowedOrigins = [
  process.env.CLIENT_URL,
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
]
  .filter(Boolean)
  .map((o) => o.replace(/\/$/, ""));

const corsOptions = {
  origin: function (origin, callback) {
    // Allow no-origin requests (curl, Postman, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked: ${origin}`);
      callback(new Error(`Origin not allowed: ${origin}`));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  },
});

// Initialize Firebase first
initFirebase();

// Middlewares
app.use(helmet({ contentSecurityPolicy: false }));

app.options("*", cors(corsOptions));
app.use(cors(corsOptions));

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());
app.use(morgan("dev"));

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/student", require("./routes/student"));
app.use("/api/faculty", require("./routes/faculty"));
app.use("/api/exam", require("./routes/exam"));
app.use("/api/monitor", require("./routes/monitor"));

// Health check
app.get("/api/health", (req, res) =>
  res.json({ status: "OK", timestamp: new Date() }),
);

// Setup WebSocket
setupExamSocket(io);

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ message: err.message });
});

const PORT = process.env.PORT || 5000;

// Listen on all interfaces (required for Render deployment)
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(
    `🌐 Client URL: ${process.env.CLIENT_URL || "http://localhost:5173"}`,
  );
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`
❌ Port ${PORT} is already in use.
`);
    console.error("To fix, run ONE of these commands:");
    console.error(
      `  PowerShell: Stop-Process -Id (Get-NetTCPConnection -LocalPort ${PORT}).OwningProcess -Force`,
    );
    console.error(
      `  CMD:        netstat -ano | findstr :${PORT}  →  taskkill /PID <pid> /F`,
    );
    console.error(`  Or change the port: set PORT=5001 in backend/.env
`);
    process.exit(1);
  } else {
    throw err;
  }
});

module.exports = { io };
