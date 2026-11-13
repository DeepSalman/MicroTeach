const express = require('express');
const cors = require('cors');
require('dotenv').config();

const db = require('./db');
const access = require('./access');
const userRoutes = require('./routes/userRoutes');
const skillRoutes = require('./routes/skillRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const postRoutes = require('./routes/postRoutes');
const teacherApplicationRoutes = require('./routes/teacherApplicationRoutes');
const reportRoutes = require('./routes/reportRoutes');
const postApplicationRoutes = require('./routes/postApplicationRoutes');
const messageRoutes = require('./routes/messageRoutes');
const walletRoutes = require('./routes/walletRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const transactionDisputeRoutes = require('./routes/transactionDisputeRoutes');
const masterDataRoutes = require('./routes/masterDataRoutes');

const app = express();

app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

const isProduction = Boolean(process.env.VERCEL || process.env.NODE_ENV === 'production');
const configuredOrigins = new Set(
  [process.env.FRONTEND_ORIGIN, process.env.PUBLIC_ORIGIN]
    .filter(Boolean)
    .flatMap((value) => value.split(',').map((origin) => origin.trim()))
);
if (!isProduction) {
  configuredOrigins.add('http://localhost:5173');
  configuredOrigins.add('http://127.0.0.1:5173');
}

function trustedOrigin(req, origin) {
  if (configuredOrigins.has(origin)) return true;
  try {
    const parsed = new URL(origin);
    return parsed.host === req.get('host') &&
      parsed.protocol === (isProduction ? 'https:' : 'http:');
  } catch {
    return false;
  }
}

app.use((req, res, next) => {
  const origin = req.get('origin');
  if (origin && !trustedOrigin(req, origin)) {
    return res.status(403).json({ message: 'Origin is not allowed.' });
  }
  next();
});
app.use(cors({
  origin: (origin, callback) => callback(null, origin || false),
  credentials: true
}));
app.use(express.json());

// URL Normalization Middleware for Vercel Serverless
app.use((req, res, next) => {
  const matchedPath = req.headers['x-matched-path'] || req.headers['x-forwarded-uri'];
  if (matchedPath && (req.url.includes('index.js') || req.url.includes('[...all]') || req.url === '/api' || req.url === '/api/')) {
    req.url = matchedPath;
  }
  next();
});

// API Routes (Dual-mounted for /api and direct paths for Vercel serverless compatibility)
const apiRoutes = [
  ['/users', userRoutes],
  ['/skills', skillRoutes],
  ['/sessions', sessionRoutes],
  ['/posts', postRoutes],
  ['/teacher-applications', teacherApplicationRoutes],
  ['/reports', reportRoutes],
  ['/post-applications', postApplicationRoutes],
  ['/messages', messageRoutes],
  ['/wallet', walletRoutes],
  ['/reviews', reviewRoutes],
  ['/transaction-disputes', transactionDisputeRoutes],
  ['/master-data', masterDataRoutes]
];

apiRoutes.forEach(([subPath, handler]) => {
  app.use(`/api${subPath}`, access(subPath.slice(1)), handler);
  app.use(subPath, access(subPath.slice(1)), handler);
});

// Root Test Route
app.get('/api', (req, res) => {
  res.json({ status: 'ok', message: 'Microteach Backend API is running!' });
});

app.get('/', (req, res) => {
  res.send('Microteach Backend API is running!');
});

module.exports = app;

const PORT = process.env.PORT || 5000;
if (require.main === module) {
  db.initSchema.then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  });
}
