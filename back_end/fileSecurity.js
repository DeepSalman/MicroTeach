const path = require('path');

const FILE_TYPES = {
  'image/jpeg': { extensions: ['.jpg', '.jpeg'], kind: 'image' },
  'image/png': { extensions: ['.png'], kind: 'image' },
  'image/webp': { extensions: ['.webp'], kind: 'image' },
  'image/gif': { extensions: ['.gif'], kind: 'image' },
  'application/pdf': { extensions: ['.pdf'], kind: 'pdf' }
};

function detectFileType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'image/jpeg';
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (['GIF87a', 'GIF89a'].includes(buffer.toString('ascii', 0, 6))) return 'image/gif';
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (buffer.toString('ascii', 0, 5) === '%PDF-') return 'application/pdf';
  return null;
}

function safeFileName(name) {
  const basename = path.posix.basename(String(name || '').replace(/\\/g, '/'));
  return basename.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 100);
}

function validateUpload(file, allowPdf = false) {
  const mime = detectFileType(file?.buffer);
  const type = FILE_TYPES[mime];
  const name = safeFileName(file?.originalname);
  if (!type || (!allowPdf && type.kind === 'pdf') || file.mimetype !== mime ||
      !type.extensions.includes(path.extname(name).toLowerCase())) {
    throw new Error('File contents, type, and extension must match an allowed image or PDF.');
  }
  return { mime, kind: type.kind, name };
}

function decodeStoredDataUri(data) {
  if (typeof data !== 'string' || !/^data:[^,]+;base64,/.test(data)) return null;
  return Buffer.from(data.slice(data.indexOf(',') + 1), 'base64');
}

function sendPrivateFile(res, buffer, storedMime, fileName, allowPdf = false) {
  const detectedMime = detectFileType(buffer);
  const type = FILE_TYPES[detectedMime];
  if (!type || (storedMime && detectedMime !== storedMime) || (!allowPdf && type.kind === 'pdf')) return false;
  res.setHeader('Content-Type', detectedMime);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  res.setHeader('Content-Disposition', type.kind === 'pdf'
    ? `attachment; filename="${safeFileName(fileName) || 'document.pdf'}"`
    : 'inline');
  res.send(buffer);
  return true;
}

module.exports = { FILE_TYPES, validateUpload, decodeStoredDataUri, sendPrivateFile };
