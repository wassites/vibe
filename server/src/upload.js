'use strict';

const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

// Garante que a pasta existe
const UPLOAD_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Tipos permitidos
const ALLOWED = {
  'image/jpeg':  'img',
  'image/png':   'img',
  'image/gif':   'img',
  'image/webp':  'img',
  'audio/mpeg':  'audio',
  'audio/ogg':   'audio',
  'audio/wav':   'audio',
  'audio/webm':  'audio',
  'video/mp4':   'video',
  'video/webm':  'video',
  'video/ogg':   'video',
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename:    (req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, name);
  },
});

const fileFilter = (req, file, cb) => {
  if (ALLOWED[file.mimetype]) cb(null, true);
  else cb(new Error(`Tipo não permitido: ${file.mimetype}`), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB
  },
});

module.exports = { upload, UPLOAD_DIR, ALLOWED };
