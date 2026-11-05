const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Allowed MIME types
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
  'application/pdf',
]);

// Size limits per media category in bytes
const SIZE_LIMITS = {
  image: 10 * 1024 * 1024,      // 10 MB
  video: 100 * 1024 * 1024,    // 100 MB
  audio: 20 * 1024 * 1024,     // 20 MB
  document: 25 * 1024 * 1024,  // 25 MB
};

const getCategoryByMime = (mimeType) => {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType === 'application/pdf') return 'document';
  return null;
};

// Map MIME type to default extension
const MIME_EXT_MAP = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
  'audio/mpeg': '.mp3',
  'audio/wav': '.wav',
  'audio/ogg': '.ogg',
  'audio/webm': '.webm',
  'application/pdf': '.pdf',
};

// Magic bytes validation
const validateMagicBytes = (buffer, mimeType) => {
  if (!buffer || buffer.length < 4) return false;

  // JPEG: FF D8 FF
  if (mimeType === 'image/jpeg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  // PNG: 89 50 4E 47
  if (mimeType === 'image/png') {
    return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  }

  // GIF: 47 49 46 38 ("GIF8")
  if (mimeType === 'image/gif') {
    return buffer.toString('ascii', 0, 4) === 'GIF8';
  }

  // WebP: RIFF....WEBP
  if (mimeType === 'image/webp') {
    if (buffer.length < 12) return false;
    return (
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP'
    );
  }

  // PDF: 25 50 44 46 ("%PDF")
  if (mimeType === 'application/pdf') {
    return buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
  }

  // WebM: 1A 45 DF A3
  if (mimeType === 'video/webm' || mimeType === 'audio/webm') {
    return buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3;
  }

  // MP4 / MOV: looks for 'ftyp' or 'moov' brand box at byte 4
  if (mimeType === 'video/mp4' || mimeType === 'video/quicktime') {
    if (buffer.length < 12) return false;
    const boxType = buffer.toString('ascii', 4, 8);
    return boxType === 'ftyp' || boxType === 'moov' || boxType === 'wide';
  }

  // Audio MP3: ID3 tag or MPEG sync word FF FB / FF F3 / FF F2
  if (mimeType === 'audio/mpeg') {
    if (buffer.toString('ascii', 0, 3) === 'ID3') return true;
    return buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0;
  }

  // Audio WAV: RIFF....WAVE
  if (mimeType === 'audio/wav') {
    if (buffer.length < 12) return false;
    return (
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WAVE'
    );
  }

  // Audio OGG: 4F 67 67 53 ("OggS")
  if (mimeType === 'audio/ogg') {
    return buffer.toString('ascii', 0, 4) === 'OggS';
  }

  return false;
};

// Memory storage keeps buffer in memory for security checks before forwarding to ImageKit
const storage = multer.memoryStorage();

// Multer upload instance
const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // Global ceiling 100MB
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(
        new Error(`Unsupported file type: ${file.mimetype}. Allowed types: JPEG, PNG, WEBP, GIF, MP4, WEBM, MOV, MP3, WAV, OGG, PDF`),
        false
      );
    }
    cb(null, true);
  },
});

/**
 * Middleware wrapper that executes multer, verifies file category size limits,
 * validates magic bytes signatures, and assigns a secure server-controlled filename.
 */
const handleUpload = (fieldName = 'file') => {
  const multerSingle = upload.single(fieldName);

  return (req, res, next) => {
    multerSingle(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
              success: false,
              message: 'File size exceeds maximum allowed limit of 100MB',
              code: 'FILE_TOO_LARGE',
            });
          }
          return res.status(400).json({
            success: false,
            message: `Multer upload error: ${err.message}`,
            code: 'UPLOAD_ERROR',
          });
        }
        return res.status(400).json({
          success: false,
          message: err.message,
          code: 'INVALID_FILE_TYPE',
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded. Please provide a file in the form-data.',
          code: 'FILE_MISSING',
        });
      }

      const mimeType = req.file.mimetype;
      const category = getCategoryByMime(mimeType);

      if (!category) {
        return res.status(400).json({
          success: false,
          message: 'Unsupported media category',
          code: 'UNSUPPORTED_MEDIA_CATEGORY',
        });
      }

      // Check specific category size limits
      const maxAllowedSize = SIZE_LIMITS[category];
      if (req.file.size > maxAllowedSize) {
        const sizeInMb = Math.round(maxAllowedSize / (1024 * 1024));
        return res.status(400).json({
          success: false,
          message: `${category.charAt(0).toUpperCase() + category.slice(1)} files cannot exceed ${sizeInMb}MB`,
          code: 'FILE_TOO_LARGE',
        });
      }

      // Verify Magic Bytes
      const isValidSignature = validateMagicBytes(req.file.buffer, mimeType);
      if (!isValidSignature) {
        return res.status(400).json({
          success: false,
          message: 'File content does not match its claimed MIME type (signature check failed)',
          code: 'MAGIC_BYTES_MISMATCH',
        });
      }

      // Generate unique server-controlled filename
      const originalExt = path.extname(req.file.originalname).toLowerCase();
      const safeExt = originalExt || MIME_EXT_MAP[mimeType] || '.bin';
      const uniqueFileName = `${uuidv4()}${safeExt}`;

      req.file.uniqueName = uniqueFileName;
      req.file.mediaCategory = category;

      next();
    });
  };
};

module.exports = {
  upload,
  handleUpload,
  validateMagicBytes,
  ALLOWED_MIME_TYPES,
  SIZE_LIMITS,
};
