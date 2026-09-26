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
const messageRoutes = require('./routes/messageRoutes');
const walletRoutes = require('./routes/walletRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const transactionDisputeRoutes = require('./routes/transactionDisputeRoutes');

const app = express();

app.use(cors());
app.use(express.json());

// Serve uploaded files (teacher documents, etc.)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/users', userRoutes);
app.use('/api/skills', skillRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/teacher-applications', teacherApplicationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/post-applications', postApplicationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/transaction-disputes', transactionDisputeRoutes);

// Root Test Route
app.get('/', (req, res) => {
  res.send('Microteach Backend API is running!');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
