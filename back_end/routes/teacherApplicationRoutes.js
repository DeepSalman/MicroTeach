const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');

// ── Ensure upload directory exists ──
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'teacher_documents');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ── Auto-create Teacher_Application_Documents table ──
(async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS Teacher_Application_Documents (
        document_id   INT AUTO_INCREMENT PRIMARY KEY,
        application_id INT NOT NULL,
        document_type ENUM('student_id_card','nid_card') NOT NULL,
        file_path     VARCHAR(512) NOT NULL,
        file_name     VARCHAR(255) NOT NULL,
        file_size     INT NOT NULL,
        mime_type     VARCHAR(100) NOT NULL,
        created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (application_id) REFERENCES Teacher_Applications(application_id) ON DELETE CASCADE
      )
    `);
    // Add student_id column to Teacher_Applications if missing
    const [cols] = await db.query(`SHOW COLUMNS FROM Teacher_Applications LIKE 'student_id'`);
    if (cols.length === 0) {
      await db.query(`ALTER TABLE Teacher_Applications ADD COLUMN student_id VARCHAR(50) AFTER user_id`);
    }
  } catch (e) {
    console.error('[teacherApplicationRoutes] Schema init error:', e.message);
  }
})();

// ── Multer disk storage ──
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}_${Math.round(Math.random() * 1e6)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  }
});
const fileFilter = (_req, file, cb) => {
  if (file.mimetype.startsWith('image/')) cb(null, true);
  else cb(new Error('Only image files are allowed.'), false);
};
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB
});
const uploadDocs = upload.fields([
  { name: 'student_id_card', maxCount: 1 },
  { name: 'nid_card',        maxCount: 1 }
]);

// ── GET all teacher applications ──
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        ta.application_id,
        ta.user_id,
        ta.student_id,
        ta.reason,
        ta.expertise,
        ta.status,
        ta.created_at,
        ta.reviewed_at,
        u.full_name,
        u.email,
        u.student_id AS user_student_id,
        u.department,
        u.role
      FROM Teacher_Applications ta
      JOIN Users u ON ta.user_id = u.user_id
      ORDER BY ta.created_at DESC
    `);

    // Attach documents to each application
    const appIds = rows.map(r => r.application_id);
    let docMap = {};
    if (appIds.length > 0) {
      const placeholders = appIds.map(() => '?').join(',');
      const [docs] = await db.query(
        `SELECT * FROM Teacher_Application_Documents WHERE application_id IN (${placeholders})`,
        appIds
      );
      docs.forEach(d => {
        if (!docMap[d.application_id]) docMap[d.application_id] = [];
        docMap[d.application_id].push(d);
      });
    }
    const result = rows.map(r => ({ ...r, documents: docMap[r.application_id] || [] }));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET applications for a specific user ──
router.get('/user/:userId', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM Teacher_Applications WHERE user_id = ? ORDER BY created_at DESC',
      [req.params.userId]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── POST submit a new teacher application (multipart) ──
router.post('/', (req, res) => {
  uploadDocs(req, res, async (uploadErr) => {
    if (uploadErr) {
      return res.status(400).json({ message: uploadErr.message });
    }

    const { user_id, reason, expertise } = req.body;
    const studentIdCardFile = req.files?.['student_id_card']?.[0];
    const nidCardFile       = req.files?.['nid_card']?.[0];

    // ── Validation ──
    if (!user_id || !reason) {
      return res.status(400).json({ message: 'User ID and reason are required.' });
    }
    if (!studentIdCardFile || !nidCardFile) {
      return res.status(400).json({ message: 'Both Student ID card and NID card images are required.' });
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // Check user exists and not already a tutor
      const [users] = await conn.query('SELECT role FROM Users WHERE user_id = ?', [user_id]);
      if (users.length === 0) {
        await conn.rollback();
        return res.status(404).json({ message: 'User not found.' });
      }
      if (users[0].role === 'tutor' || users[0].role === 'both') {
        await conn.rollback();
        return res.status(400).json({ message: 'User is already a tutor.' });
      }

      // Check no pending application
      const [existing] = await conn.query(
        'SELECT application_id FROM Teacher_Applications WHERE user_id = ? AND status = ?',
        [user_id, 'pending']
      );
      if (existing.length > 0) {
        await conn.rollback();
        return res.status(400).json({ message: 'You already have a pending application.' });
      }

      // Insert application
      const [appResult] = await conn.query(
        'INSERT INTO Teacher_Applications (user_id, reason, expertise) VALUES (?, ?, ?)',
        [user_id, reason.trim(), (expertise || '').trim()]
      );
      const applicationId = appResult.insertId;

      // Insert documents
      const docsToInsert = [
        { type: 'student_id_card', file: studentIdCardFile },
        { type: 'nid_card',        file: nidCardFile }
      ];
      for (const { type, file } of docsToInsert) {
        const relativePath = path.join('uploads', 'teacher_documents', file.filename);
        await conn.query(
          `INSERT INTO Teacher_Application_Documents
           (application_id, document_type, file_path, file_name, file_size, mime_type)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [applicationId, type, relativePath, file.originalname, file.size, file.mimetype]
        );
      }

      await conn.commit();
      res.status(201).json({ message: 'Application submitted successfully.', application_id: applicationId });
    } catch (error) {
      await conn.rollback();
      // Clean up uploaded files on DB error
      [studentIdCardFile, nidCardFile].forEach(f => {
        if (f && fs.existsSync(f.path)) fs.unlinkSync(f.path);
      });
      res.status(500).json({ error: error.message });
    } finally {
      conn.release();
    }
  });
});

// ── PUT review an application (approve / reject) ──
router.put('/:id/review', async (req, res) => {
  const { status, reviewed_by } = req.body;
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ message: 'Status must be approved or rejected.' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [apps] = await conn.query(
      'SELECT * FROM Teacher_Applications WHERE application_id = ?',
      [req.params.id]
    );
    if (apps.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Application not found.' });
    }

    await conn.query(
      'UPDATE Teacher_Applications SET status = ?, reviewed_by = ?, reviewed_at = NOW() WHERE application_id = ?',
      [status, reviewed_by, req.params.id]
    );

    if (status === 'approved') {
      await conn.query(
        "UPDATE Users SET role = 'both', is_verified = 1 WHERE user_id = ?",
        [apps[0].user_id]
      );
    }

    await conn.commit();
    res.json({ message: `Application ${status} successfully.` });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    conn.release();
  }
});

module.exports = router;
