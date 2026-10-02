const express = require('express');
const router = express.Router();
const db = require('../db');

const createTableSql = db.isPostgres
  ? `CREATE TABLE IF NOT EXISTS post_comments (
      comment_id SERIAL PRIMARY KEY,
      post_id INT NOT NULL REFERENCES posts(post_id) ON DELETE CASCADE,
      user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      parent_comment_id INT REFERENCES post_comments(comment_id) ON DELETE CASCADE,
      content TEXT NOT NULL CHECK (char_length(trim(content)) BETWEEN 1 AND 2000),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`
  : `CREATE TABLE IF NOT EXISTS Post_Comments (
      comment_id INT AUTO_INCREMENT PRIMARY KEY,
      post_id INT NOT NULL,
      user_id INT NOT NULL,
      parent_comment_id INT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_post_comments_post_created (post_id, created_at, comment_id),
      FOREIGN KEY (post_id) REFERENCES Posts(post_id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
      FOREIGN KEY (parent_comment_id) REFERENCES Post_Comments(comment_id) ON DELETE CASCADE
    )`;

const schemaReady = db.query(createTableSql).then(() => {
  console.log('[postCommentRoutes] Post_Comments table ensured');
}).catch((error) => {
  console.error('[postCommentRoutes] Schema setup failed:', error.message);
  throw error;
});

const commentSelect = `
  SELECT
    c.comment_id,
    c.post_id,
    c.user_id,
    c.parent_comment_id,
    c.content,
    c.created_at,
    u.full_name AS author_name,
    u.department AS author_department,
    u.avatar_color AS author_avatar_color
  FROM Post_Comments c
  JOIN Users u ON u.user_id = c.user_id
`;

router.get('/post/:postId', async (req, res) => {
  const postId = Number(req.params.postId);
  if (!Number.isInteger(postId) || postId < 1) {
    return res.status(400).json({ message: 'Invalid post ID.' });
  }

  try {
    await schemaReady;
    const [comments] = await db.query(
      `${commentSelect} WHERE c.post_id = ? ORDER BY c.created_at ASC, c.comment_id ASC`,
      [postId]
    );
    res.json(comments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  const postId = Number(req.body.post_id);
  const userId = Number(req.body.user_id);
  const parentCommentId = req.body.parent_comment_id ? Number(req.body.parent_comment_id) : null;
  const content = typeof req.body.content === 'string' ? req.body.content.trim() : '';

  if (!Number.isInteger(postId) || postId < 1 || !Number.isInteger(userId) || userId < 1) {
    return res.status(400).json({ message: 'Post ID and user ID are required.' });
  }
  if (!content || content.length > 2000) {
    return res.status(400).json({ message: 'Comments must be between 1 and 2000 characters.' });
  }
  if (parentCommentId !== null && (!Number.isInteger(parentCommentId) || parentCommentId < 1)) {
    return res.status(400).json({ message: 'Invalid reply target.' });
  }

  try {
    await schemaReady;
    const [posts] = await db.query('SELECT post_id FROM Posts WHERE post_id = ?', [postId]);
    if (posts.length === 0) return res.status(404).json({ message: 'Post not found.' });

    const [users] = await db.query('SELECT user_id FROM Users WHERE user_id = ?', [userId]);
    if (users.length === 0) return res.status(404).json({ message: 'User not found.' });

    if (parentCommentId !== null) {
      const [parents] = await db.query(
        'SELECT comment_id FROM Post_Comments WHERE comment_id = ? AND post_id = ?',
        [parentCommentId, postId]
      );
      if (parents.length === 0) return res.status(400).json({ message: 'Reply target must belong to this post.' });
    }

    const [result] = await db.query(
      'INSERT INTO Post_Comments (post_id, user_id, parent_comment_id, content) VALUES (?, ?, ?, ?)',
      [postId, userId, parentCommentId, content]
    );
    const [created] = await db.query(`${commentSelect} WHERE c.comment_id = ?`, [result.insertId]);
    res.status(201).json(created[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;