const express = require('express');
const router = express.Router();
const db = require('../db');
const crypto = require('crypto');

// 1. Get inbox: all conversations for a user, sorted by recent activity
router.get('/inbox/:userId', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        c.conversation_id,
        c.post_id,
        c.last_message_preview,
        c.last_message_at,
        cm.last_read_seq,
        cm.last_delivered_seq,
        cm.muted,
        COALESCE(lm.max_seq, 0) - cm.last_read_seq AS unread_count,
        p.title AS post_title,
        p.course_code,
        other_user.user_id AS other_user_id,
        other_user.full_name AS other_user_name,
        other_user.department AS other_user_department
      FROM Conversation_Members cm
      JOIN Conversations c ON cm.conversation_id = c.conversation_id
      LEFT JOIN Posts p ON c.post_id = p.post_id
      JOIN Conversation_Members other_cm
        ON other_cm.conversation_id = c.conversation_id AND other_cm.user_id != cm.user_id
      JOIN Users other_user ON other_cm.user_id = other_user.user_id
      LEFT JOIN (
        SELECT conversation_id, MAX(seq) AS max_seq
        FROM Messages
        GROUP BY conversation_id
      ) lm ON lm.conversation_id = c.conversation_id
      WHERE cm.user_id = ?
      ORDER BY c.last_message_at DESC
    `, [req.params.userId]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Get messages for a conversation (with cursor-based pagination)
router.get('/:conversationId/messages', async (req, res) => {
  const { before_seq, limit = 50 } = req.query;
  try {
    let query = `
      SELECT
        m.seq,
        m.sender_id,
        m.kind,
        m.body,
        m.created_at,
        u.full_name AS sender_name
      FROM Messages m
      JOIN Users u ON m.sender_id = u.user_id
      WHERE m.conversation_id = ?
    `;
    const params = [req.params.conversationId];

    if (before_seq) {
      query += ' AND m.seq < ?';
      params.push(before_seq);
    }

    query += ' ORDER BY m.seq DESC LIMIT ?';
    params.push(parseInt(limit));

    const [rows] = await db.query(query, params);
    res.json(rows.reverse()); // return oldest-first for display
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Send a message
router.post('/:conversationId/messages', async (req, res) => {
  const { sender_id, body, client_msg_id } = req.body;
  const convId = req.params.conversationId;

  if (!sender_id || !body || !client_msg_id) {
    return res.status(400).json({ message: 'sender_id, body, and client_msg_id are required.' });
  }

  try {
    // Verify sender is a member of the conversation
    const [member] = await db.query(
      'SELECT user_id FROM Conversation_Members WHERE user_id = ? AND conversation_id = ?',
      [sender_id, convId]
    );
    if (member.length === 0) {
      return res.status(403).json({ message: 'You are not a member of this conversation.' });
    }

    // Idempotency: check if client_msg_id already exists
    const [existing] = await db.query(
      'SELECT seq FROM Messages WHERE conversation_id = ? AND client_msg_id = ?',
      [convId, client_msg_id]
    );
    if (existing.length > 0) {
      return res.json({ seq: existing[0].seq, message: 'Message already sent.' });
    }

    // Get next seq
    const [maxSeq] = await db.query(
      'SELECT COALESCE(MAX(seq), 0) + 1 AS next_seq FROM Messages WHERE conversation_id = ?',
      [convId]
    );
    const nextSeq = maxSeq[0].next_seq;

    // Insert message
    await db.query(
      'INSERT INTO Messages (conversation_id, seq, sender_id, body, client_msg_id) VALUES (?, ?, ?, ?, ?)',
      [convId, nextSeq, sender_id, body, client_msg_id]
    );

    // Update conversation preview + timestamp
    const preview = body.length > 180 ? body.substring(0, 180) + '...' : body;
    await db.query(
      'UPDATE Conversations SET last_message_preview = ?, last_message_at = NOW(3) WHERE conversation_id = ?',
      [preview, convId]
    );

    // Update sender's last_delivered_seq
    await db.query(
      'UPDATE Conversation_Members SET last_delivered_seq = ? WHERE user_id = ? AND conversation_id = ?',
      [nextSeq, sender_id, convId]
    );

    res.status(201).json({ seq: nextSeq, message: 'Message sent.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Mark conversation as read (update cursor)
router.patch('/:conversationId/read', async (req, res) => {
  const { user_id, seq } = req.body;
  try {
    await db.query(
      'UPDATE Conversation_Members SET last_read_seq = GREATEST(last_read_seq, ?) WHERE user_id = ? AND conversation_id = ?',
      [seq, user_id, req.params.conversationId]
    );
    res.json({ message: 'Marked as read.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Start or get existing conversation between two users about a post
router.post('/start', async (req, res) => {
  const { user_id, other_user_id, post_id } = req.body;

  if (!user_id || !other_user_id) {
    return res.status(400).json({ message: 'user_id and other_user_id are required.' });
  }

  try {
    // Check if conversation already exists between these two users
    const [existing] = await db.query(`
      SELECT c.conversation_id
      FROM Conversations c
      JOIN Conversation_Members cm1 ON c.conversation_id = cm1.conversation_id AND cm1.user_id = ?
      JOIN Conversation_Members cm2 ON c.conversation_id = cm2.conversation_id AND cm2.user_id = ?
      ${post_id ? 'WHERE c.post_id = ?' : ''}
    `, post_id ? [user_id, other_user_id, post_id] : [user_id, other_user_id]);

    if (existing.length > 0) {
      return res.json({ conversation_id: existing[0].conversation_id, message: 'Existing conversation found.' });
    }

    // Create new conversation
    const [result] = await db.query(
      'INSERT INTO Conversations (post_id) VALUES (?)',
      [post_id || null]
    );
    const convId = result.insertId;

    // Add both members
    await db.query(
      'INSERT INTO Conversation_Members (user_id, conversation_id) VALUES (?, ?), (?, ?)',
      [user_id, convId, other_user_id, convId]
    );

    res.status(201).json({ conversation_id: convId, message: 'Conversation started.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Get total unread count for a user (for badge on message icon)
router.get('/unread/:userId', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT COALESCE(SUM(lm.max_seq - cm.last_read_seq), 0) AS total_unread
      FROM Conversation_Members cm
      JOIN (
        SELECT conversation_id, MAX(seq) AS max_seq
        FROM Messages
        GROUP BY conversation_id
      ) lm ON cm.conversation_id = lm.conversation_id
      WHERE cm.user_id = ?
    `, [req.params.userId]);
    res.json({ unread: rows[0].total_unread });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
