const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');

const os = require('os');

// ── Ensure uploads directory exists ──
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const UPLOAD_DIR = isServerless
  ? path.join(os.tmpdir(), 'uploads', 'chat_attachments')
  : path.join(__dirname, '..', 'uploads', 'chat_attachments');

try {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
} catch (err) {
  console.warn('[messageRoutes] Upload dir creation warning:', err.message);
}

// ── Auto-ensure table columns exist on startup ──
(async () => {
  if (db.isPostgres) return;
  try {
    const [cols] = await db.query('SHOW COLUMNS FROM Messages');
    const existing = cols.map(c => c.Field);
    if (!existing.includes('file_path')) {
      await db.query('ALTER TABLE Messages ADD COLUMN file_path VARCHAR(512) NULL AFTER body');
    }
    if (!existing.includes('file_name')) {
      await db.query('ALTER TABLE Messages ADD COLUMN file_name VARCHAR(255) NULL AFTER file_path');
    }
    if (!existing.includes('file_size')) {
      await db.query('ALTER TABLE Messages ADD COLUMN file_size INT NULL AFTER file_name');
    }
    if (!existing.includes('mime_type')) {
      await db.query('ALTER TABLE Messages ADD COLUMN mime_type VARCHAR(100) NULL AFTER file_size');
    }
    if (!existing.includes('file_data')) {
      await db.query('ALTER TABLE Messages ADD COLUMN file_data LONGTEXT NULL AFTER mime_type');
    }
    console.log('[messageRoutes] Messages attachment columns verified');

    // Merge any duplicate conversations between the same pair of users
    const [duplicates] = await db.query(`
      SELECT 
        LEAST(cm1.user_id, cm2.user_id) AS user_a,
        GREATEST(cm1.user_id, cm2.user_id) AS user_b,
        COUNT(DISTINCT c.conversation_id) AS conv_count,
        GROUP_CONCAT(DISTINCT c.conversation_id ORDER BY c.last_message_at DESC, c.conversation_id DESC) AS conv_ids
      FROM Conversations c
      JOIN Conversation_Members cm1 ON c.conversation_id = cm1.conversation_id
      JOIN Conversation_Members cm2 ON c.conversation_id = cm2.conversation_id AND cm1.user_id < cm2.user_id
      GROUP BY user_a, user_b
      HAVING conv_count > 1
    `);

    for (const dup of duplicates) {
      const convIds = dup.conv_ids.split(',').map(Number);
      const primaryConvId = convIds[0];
      const secondaries = convIds.slice(1);

      for (const secId of secondaries) {
        const [secMsgs] = await db.query(
          'SELECT * FROM Messages WHERE conversation_id = ? ORDER BY seq ASC',
          [secId]
        );
        for (const msg of secMsgs) {
          const [maxSeq] = await db.query(
            'SELECT COALESCE(MAX(seq), 0) + 1 AS next_seq FROM Messages WHERE conversation_id = ?',
            [primaryConvId]
          );
          const nextSeq = maxSeq[0].next_seq;
          await db.query(
            `INSERT INTO Messages (conversation_id, seq, sender_id, kind, body, file_path, file_name, file_size, mime_type, client_msg_id, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [primaryConvId, nextSeq, msg.sender_id, msg.kind, msg.body, msg.file_path, msg.file_name, msg.file_size, msg.mime_type, msg.client_msg_id ? msg.client_msg_id + '_merged' : null, msg.created_at]
          );
        }
        await db.query('DELETE FROM Conversations WHERE conversation_id = ?', [secId]);
      }
    }
  } catch (err) {
    console.error('[messageRoutes] Schema verification error:', err.message);
  }
})();

// ── Multer Storage Configuration for Chat Attachments ──
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}_${Math.round(Math.random() * 1e6)}`;
    const cleanExt = path.extname(file.originalname).toLowerCase();
    cb(null, `${unique}${cleanExt}`);
  }
});

const fileFilter = (_req, file, cb) => {
  const allowed = [
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf'
  ];
  if (allowed.includes(file.mimetype) || file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only images (JPEG, PNG, WEBP, GIF) and PDF documents are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 25 * 1024 * 1024 } // 25 MB max limit
});

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
        p.bounty AS post_bounty,
        p.status AS post_status,
        p.category AS post_category,
        p.user_id AS post_owner_id,
        pa.application_id,
        pa.user_id AS accepted_tutor_id,
        pa.status AS application_status,
        pa.completion_requested_by,
        other_user.user_id AS other_user_id,
        other_user.full_name AS other_user_name,
        other_user.department AS other_user_department,
        other_user.avatar_color AS other_user_avatar_color
      FROM Conversation_Members cm
      JOIN Conversations c ON cm.conversation_id = c.conversation_id
      LEFT JOIN Posts p ON c.post_id = p.post_id
      JOIN Conversation_Members other_cm
        ON other_cm.conversation_id = c.conversation_id AND other_cm.user_id != cm.user_id
      LEFT JOIN Post_Applications pa
        ON pa.post_id = c.post_id
        AND pa.status IN ('accepted', 'cancellation_requested', 'completion_requested', 'cancelled')
        AND (
          (pa.user_id = cm.user_id AND p.user_id = other_cm.user_id)
          OR (pa.user_id = other_cm.user_id AND p.user_id = cm.user_id)
        )
      JOIN Users other_user ON other_cm.user_id = other_user.user_id
      LEFT JOIN (
        SELECT conversation_id, MAX(seq) AS max_seq
        FROM Messages
        GROUP BY conversation_id
      ) lm ON lm.conversation_id = c.conversation_id
      WHERE cm.user_id = ?
      ORDER BY c.last_message_at DESC, c.conversation_id DESC
    `, [req.params.userId]);

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Get messages for a conversation (with attachment fields)
router.get('/:conversationId/messages', async (req, res) => {
  const { before_seq, limit = 50 } = req.query;
  try {
    let query = `
      SELECT
        m.seq,
        m.sender_id,
        m.kind,
        m.body,
        m.file_path,
        m.file_name,
        m.file_size,
        m.mime_type,
        m.file_data,
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

// 3. Send a message (handles both plain text and multipart file attachments)
router.post('/:conversationId/messages', (req, res) => {
  upload.single('attachment')(req, res, async (uploadErr) => {
    if (uploadErr) {
      return res.status(400).json({ message: uploadErr.message });
    }

    const convId = req.params.conversationId;
    const { sender_id, client_msg_id } = req.body;
    let body = (req.body.body || '').trim();
    const file = req.file;

    if (!sender_id) {
      return res.status(400).json({ message: 'sender_id is required.' });
    }
    if (!body && !file) {
      return res.status(400).json({ message: 'Message text or attachment is required.' });
    }

    const effectiveClientMsgId = client_msg_id || `${Date.now()}_${Math.random()}`;

    try {
      // Verify sender is a member of the conversation
      const [member] = await db.query(
        'SELECT user_id FROM Conversation_Members WHERE user_id = ? AND conversation_id = ?',
        [sender_id, convId]
      );
      if (member.length === 0) {
        if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
        return res.status(403).json({ message: 'You are not a member of this conversation.' });
      }

      // Idempotency: check if client_msg_id already exists
      const [existing] = await db.query(
        'SELECT seq FROM Messages WHERE conversation_id = ? AND client_msg_id = ?',
        [convId, effectiveClientMsgId]
      );
      if (existing.length > 0) {
        if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
        return res.json({ seq: existing[0].seq, message: 'Message already sent.' });
      }

      // Get next seq
      const [maxSeq] = await db.query(
        'SELECT COALESCE(MAX(seq), 0) + 1 AS next_seq FROM Messages WHERE conversation_id = ?',
        [convId]
      );
      const nextSeq = maxSeq[0].next_seq;

      // Determine kind and attachment fields
      let kind = 'text';
      let filePath = null;
      let fileName = null;
      let fileSize = null;
      let mimeType = null;
      let preview = '';

      let fileDataUri = null;
      if (file) {
        try {
          if (file.path && fs.existsSync(file.path)) {
            const buf = fs.readFileSync(file.path);
            fileDataUri = `data:${file.mimetype || 'image/jpeg'};base64,${buf.toString('base64')}`;
          }
        } catch (e) {
          console.warn('[messageRoutes] Error reading uploaded file into base64:', e.message);
        }

        filePath = path.posix.join('uploads', 'chat_attachments', file.filename);
        fileName = file.originalname;
        fileSize = file.size;
        mimeType = file.mimetype;

        if (file.mimetype === 'application/pdf') {
          kind = 'pdf';
          preview = body ? `📄 ${fileName}: ${body}` : `📄 ${fileName}`;
        } else {
          kind = 'image';
          preview = body ? `📷 ${body}` : '📷 Photo';
        }

        if (!body) {
          body = fileName;
        }
      } else {
        kind = 'text';
        preview = body.length > 180 ? body.substring(0, 180) + '...' : body;
      }

      // Insert message
      await db.query(
        `INSERT INTO Messages 
         (conversation_id, seq, sender_id, kind, body, file_path, file_name, file_size, mime_type, file_data, client_msg_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [convId, nextSeq, sender_id, kind, body, filePath, fileName, fileSize, mimeType, fileDataUri, effectiveClientMsgId]
      );

      // Update conversation preview + timestamp
      await db.query(
        'UPDATE Conversations SET last_message_preview = ?, last_message_at = NOW() WHERE conversation_id = ?',
        [preview, convId]
      );

      // Update sender's last_delivered_seq
      await db.query(
        'UPDATE Conversation_Members SET last_delivered_seq = ? WHERE user_id = ? AND conversation_id = ?',
        [nextSeq, sender_id, convId]
      );

      res.status(201).json({
        seq: nextSeq,
        kind,
        file_path: filePath,
        file_name: fileName,
        file_size: fileSize,
        mime_type: mimeType,
        file_data: fileDataUri,
        message: 'Message sent successfully.'
      });
    } catch (error) {
      if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
      res.status(500).json({ error: error.message });
    }
  });
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
  const { user_id, other_user_id } = req.body;
  const postId = req.body.post_id ? Number(req.body.post_id) : null;

  if (!user_id || !other_user_id) {
    return res.status(400).json({ message: 'user_id and other_user_id are required.' });
  }
  if (String(user_id) === String(other_user_id)) {
    return res.status(400).json({ message: 'You cannot start a conversation with yourself.' });
  }
  if (req.body.post_id && (!Number.isInteger(postId) || postId < 1)) {
    return res.status(400).json({ message: 'Invalid post ID.' });
  }

  try {
    const contextFilter = postId === null ? 'AND c.post_id IS NULL' : 'AND c.post_id = ?';
    const existingParams = [user_id, other_user_id];
    if (postId !== null) existingParams.push(postId);

    // Keep a separate conversation for each post context between the same users.
    const [existing] = await db.query(`
      SELECT c.conversation_id, c.post_id
      FROM Conversations c
      JOIN Conversation_Members cm1 ON c.conversation_id = cm1.conversation_id AND cm1.user_id = ?
      JOIN Conversation_Members cm2 ON c.conversation_id = cm2.conversation_id AND cm2.user_id = ?
      ${contextFilter}
      ORDER BY c.last_message_at DESC, c.conversation_id DESC
      LIMIT 1
    `, existingParams);

    if (existing.length > 0) {
      return res.json({ conversation_id: existing[0].conversation_id, message: 'Existing conversation found.' });
    }

    // Create new conversation
    const [result] = await db.query(
      'INSERT INTO Conversations (post_id) VALUES (?)',
      [postId]
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

// 7. Get message attachment file directly (supports both serverless base64 and disk files)
router.get('/:conversationId/:seq/file', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT file_path, file_name, mime_type, file_data FROM Messages WHERE conversation_id = ? AND seq = ?',
      [req.params.conversationId, req.params.seq]
    );
    if (rows.length === 0 || (!rows[0].file_path && !rows[0].file_data)) {
      return res.status(404).send('Attachment not found');
    }
    const msg = rows[0];
    if (msg.file_data && msg.file_data.startsWith('data:')) {
      const parts = msg.file_data.split(',');
      const mime = parts[0].split(':')[1].split(';')[0];
      const buf = Buffer.from(parts[1], 'base64');
      res.setHeader('Content-Type', mime || msg.mime_type || 'application/octet-stream');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(buf);
    }
    const diskPath = path.join(__dirname, '..', msg.file_path);
    if (fs.existsSync(diskPath)) {
      return res.sendFile(diskPath);
    }
    res.status(404).send('File not found');
  } catch (err) {
    res.status(500).send(err.message);
  }
});

module.exports = router;
