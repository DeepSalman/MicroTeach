const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { validateUpload, decodeStoredDataUri, sendPrivateFile } = require('../fileSecurity');
const { hasApprovedTutorApplication } = require('../tutorEligibility');

const os = require('os');

// ── Ensure upload directory exists ──
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const UPLOAD_DIR = isServerless
  ? path.join(os.tmpdir(), 'uploads', 'teacher_documents')
  : path.join(__dirname, '..', 'uploads', 'teacher_documents');

try {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
} catch (err) {
  console.warn('[teacherApplicationRoutes] Upload dir creation warning:', err.message);
}

// Identity images are stored once in the private database, not copied to disk.
const fileFilter = (_req, file, cb) => {
  if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) cb(null, true);
  else cb(new Error('Only JPEG, PNG, or WEBP images are allowed.'), false);
};
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB
});
const uploadDocs = upload.fields([
  { name: 'student_id_card', maxCount: 1 },
  { name: 'nid_card',        maxCount: 1 }
]);

// ── GET all teacher applications ──
router.get('/', async (req, res) => {
  if (Number(req.auth?.is_admin) !== 1) return res.status(403).json({ message: 'Access denied.' });
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
        u.role,
        u.avatar_color
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
        `SELECT document_id, application_id, document_type, created_at
           FROM Teacher_Application_Documents WHERE application_id IN (${placeholders})`,
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
  if (!req.auth || (Number(req.auth.is_admin) !== 1 &&
      String(req.auth.user_id) !== String(req.params.userId))) {
    return res.status(403).json({ message: 'Access denied.' });
  }
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

    const { reason, expertise } = req.body;
    const user_id = req.auth.user_id;
    const studentIdCardFile = req.files?.['student_id_card']?.[0];
    const nidCardFile       = req.files?.['nid_card']?.[0];

    // ── Validation ──
    if (!user_id || !reason) {
      return res.status(400).json({ message: 'User ID and reason are required.' });
    }
    if (!studentIdCardFile || !nidCardFile) {
      return res.status(400).json({ message: 'Both Student ID card and NID card images are required.' });
    }
    let studentDoc;
    let nidDoc;
    try {
      studentDoc = validateUpload(studentIdCardFile);
      nidDoc = validateUpload(nidCardFile);
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // Older tutor flags without an approval record must go through review.
      const [users] = await conn.query('SELECT student_id FROM Users WHERE user_id = ?', [user_id]);
      if (users.length === 0) {
        await conn.rollback();
        return res.status(404).json({ message: 'User not found.' });
      }
      if (await hasApprovedTutorApplication(conn, user_id)) {
        await conn.rollback();
        return res.status(400).json({ message: 'You are already registered as a verified tutor.' });
      }

      // Check no pending application
      const [existing] = await conn.query(
        'SELECT application_id FROM Teacher_Applications WHERE user_id = ? AND status = ?',
        [user_id, 'pending']
      );
      if (existing.length > 0) {
        await conn.rollback();
        return res.status(400).json({ message: 'You already have an application under review.' });
      }

      // Insert application
      const [appResult] = await conn.query(
        'INSERT INTO Teacher_Applications (user_id, student_id, reason, expertise) VALUES (?, ?, ?, ?)',
        [user_id, users[0].student_id || null, reason.trim(), (expertise || '').trim()]
      );
      let applicationId = appResult.insertId;
      if (!applicationId) {
        const [recent] = await conn.query(
          'SELECT application_id FROM Teacher_Applications WHERE user_id = ? ORDER BY application_id DESC LIMIT 1',
          [user_id]
        );
        applicationId = recent[0]?.application_id;
      }

      // Keep only the private database copy. The path column remains for legacy rows.
      const docsToInsert = [
        { type: 'student_id_card', file: studentIdCardFile, checked: studentDoc },
        { type: 'nid_card',        file: nidCardFile, checked: nidDoc }
      ];
      for (const { type, file, checked } of docsToInsert) {
        const fileDataUri = `data:${checked.mime};base64,${file.buffer.toString('base64')}`;
        const privateName = `${type}${path.extname(checked.name).toLowerCase()}`;
        await conn.query(
          `INSERT INTO Teacher_Application_Documents
           (application_id, document_type, file_path, file_name, file_size, mime_type, file_data)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [applicationId, type, '', privateName, file.size, checked.mime, fileDataUri]
        );
      }

      await conn.commit();
      res.status(201).json({ message: 'Application submitted successfully.', application_id: applicationId });
    } catch (error) {
      await conn.rollback();
      res.status(500).json({ error: error.message });
    } finally {
      conn.release();
    }
  });
});

// ── PUT review an application (approve / reject) ──
router.put('/:id/review', async (req, res) => {
    const { status } = req.body;
    const reviewed_by = req.auth.user_id;
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ message: 'Status must be approved or rejected.' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [apps] = await conn.query(
      'SELECT * FROM Teacher_Applications WHERE application_id = ? FOR UPDATE',
      [req.params.id]
    );
    if (apps.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Application not found.' });
    }
    if (apps[0].status !== 'pending') {
      await conn.rollback();
      return res.status(409).json({ message: 'Only pending applications can be reviewed.' });
    }

    await conn.query(
      'UPDATE Teacher_Applications SET status = ?, reviewed_by = ?, reviewed_at = NOW() WHERE application_id = ?',
      [status, reviewed_by || null, req.params.id]
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


// ── GET document file directly by documentId ──
router.get('/documents/:documentId/file', async (req, res) => {
  if (Number(req.auth?.is_admin) !== 1) {
    return res.status(403).send('Access denied');
  }
  try {
    const [rows] = await db.query(
      'SELECT document_type, file_path, file_name, mime_type, file_data FROM Teacher_Application_Documents WHERE document_id = ?',
      [req.params.documentId]
    );
    if (rows.length === 0) {
      return res.status(404).send('Document not found');
    }
    const doc = rows[0];
    const storedBytes = decodeStoredDataUri(doc.file_data);
    if (storedBytes) {
      if (sendPrivateFile(res, storedBytes, doc.mime_type, doc.file_name)) return;
      return res.status(404).send('Document unavailable');
    }
    // Legacy disk rows only: never allow a database path to escape this directory.
    const legacyPrefix = 'uploads/teacher_documents/';
    const normalizedPath = String(doc.file_path || '').replace(/\\/g, '/');
    if (normalizedPath.startsWith(legacyPrefix) &&
        normalizedPath.slice(legacyPrefix.length) === path.basename(normalizedPath)) {
      const diskPath = path.join(UPLOAD_DIR, path.basename(normalizedPath));
      if (fs.existsSync(diskPath) && fs.realpathSync(diskPath).startsWith(`${fs.realpathSync(UPLOAD_DIR)}${path.sep}`)) {
        if (sendPrivateFile(res, fs.readFileSync(diskPath), doc.mime_type, doc.file_name)) return;
      }
    }
    res.status(404).send('File not found');
  } catch (err) {
    res.status(500).send('Could not load document');
  }
});

module.exports = router;
