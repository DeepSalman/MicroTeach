const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const db = require('./db');
const userRoutes = require('./routes/userRoutes');
const skillRoutes = require('./routes/skillRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const postRoutes = require('./routes/postRoutes');
const teacherApplicationRoutes = require('./routes/teacherApplicationRoutes');
const reportRoutes = require('./routes/reportRoutes');
const postApplicationRoutes = require('./routes/postApplicationRoutes');
const postCommentRoutes = require('./routes/postCommentRoutes');
const messageRoutes = require('./routes/messageRoutes');
const walletRoutes = require('./routes/walletRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const transactionDisputeRoutes = require('./routes/transactionDisputeRoutes');
const masterDataRoutes = require('./routes/masterDataRoutes');

const app = express();

app.use(cors());
app.use(express.json());

// URL Normalization Middleware for Vercel Serverless
app.use((req, res, next) => {
  const matchedPath = req.headers['x-matched-path'] || req.headers['x-forwarded-uri'];
  if (matchedPath && (req.url.includes('index.js') || req.url.includes('[...all]') || req.url === '/api' || req.url === '/api/')) {
    req.url = matchedPath;
  }
  next();
});

const os = require('os');
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

// Serve uploaded files (teacher documents, chat attachments, etc.)
if (isServerless) {
  try {
    app.use('/uploads', express.static(path.join(os.tmpdir(), 'uploads')));
  } catch (_) {}
}
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes (Dual-mounted for /api and direct paths for Vercel serverless compatibility)
const apiRoutes = [
  ['/users', userRoutes],
  ['/skills', skillRoutes],
  ['/sessions', sessionRoutes],
  ['/posts', postRoutes],
  ['/teacher-applications', teacherApplicationRoutes],
  ['/reports', reportRoutes],
  ['/post-applications', postApplicationRoutes],
  ['/post-comments', postCommentRoutes],
  ['/messages', messageRoutes],
  ['/wallet', walletRoutes],
  ['/reviews', reviewRoutes],
  ['/transaction-disputes', transactionDisputeRoutes],
  ['/master-data', masterDataRoutes]
];

apiRoutes.forEach(([subPath, handler]) => {
  app.use(`/api${subPath}`, handler);
  app.use(subPath, handler);
});

// Root Test Route
app.get('/api', (req, res) => {
  res.json({ status: 'ok', message: 'Microteach Backend API is running!' });
});

app.get('/', (req, res) => {
  res.send('Microteach Backend API is running!');
});

module.exports = app;

const PORT = process.env.PORT || 3001;
if (require.main === module) {
  db.initSchema.then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  });
}
