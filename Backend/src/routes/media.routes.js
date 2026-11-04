const express = require('express');
const rateLimit = require('express-rate-limit');
const { param } = require('express-validator');
const mediaController = require('../controllers/media.controller');
const { authenticateToken } = require('../middleware/auth.middleware');
const { handleUpload } = require('../middleware/upload.middleware');
const validate = require('../middleware/validate.middleware');

const router = express.Router();

// Rate limiter for file uploads: 30 uploads per hour
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Upload limit reached: Maximum 30 uploads per hour allowed.',
    code: 'UPLOAD_RATE_LIMIT_EXCEEDED',
  },
});

// Protect all media endpoints
router.use(authenticateToken);

// Upload media file (supports both /media/upload and /upload)
router.post('/upload', uploadLimiter, handleUpload('file'), mediaController.uploadMedia);
router.post('/', uploadLimiter, handleUpload('file'), mediaController.uploadMedia);

// Delete media file
router.delete(
  '/:fileId',
  [param('fileId').notEmpty().withMessage('fileId parameter is required')],
  validate,
  mediaController.deleteMedia
);

module.exports = router;
