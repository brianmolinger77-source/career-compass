require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const path = require('path');

require('./models/Mentor');
const menteeRoutes = require('./routes/mentee');
const mentorRoutes = require('./routes/mentor');
const aiRoutes = require('./routes/ai');

const app = express();
const PORT = process.env.PORT || 3001;

// ── MongoDB connection ────────────────────────────────────────────────────────
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/career-compass';
console.log('MONGODB_URI (first 20 chars):', mongoUri.slice(0, 20));

mongoose.connection.on('connected', () => console.log('MongoDB connected'));
mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected'));
mongoose.connection.on('error', (err) => console.error('MongoDB connection error:', err));

mongoose.connect(mongoUri, { dbName: 'test' }).catch(err => console.error('MongoDB initial connection failed:', err));

app.use(cors({
  origin: true,       // mirrors request origin — works locally and on Vercel
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());

app.use(session({
  secret: (() => { if (!process.env.SESSION_SECRET) throw new Error('SESSION_SECRET environment variable is not set — server will not start'); return process.env.SESSION_SECRET; })(),
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000
  }
}));

app.use('/api/mentee', menteeRoutes);
app.use('/api/mentor', mentorRoutes);
app.use('/api', aiRoutes);

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// ── Serve React frontend (must come after API routes) ─────────────────────────
// The vercel-build script compiles the client to client/dist before deployment.
// In local dev the Vite dev server handles the frontend separately via npm run dev.
const CLIENT_DIST = path.join(__dirname, '../client/dist');
app.use(express.static(CLIENT_DIST));
app.get('*', (req, res) => {
  res.sendFile(path.join(CLIENT_DIST, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Career Compass server running on http://localhost:${PORT}`);
});
