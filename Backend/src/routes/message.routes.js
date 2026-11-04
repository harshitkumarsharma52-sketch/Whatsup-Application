const express = require('express');
const { body, param, query } = require('express-validator');
const messageController = require('../controllers/message.controller');
const { authenticateToken } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');

const router = express.Router();

// Protect all message routes
router.use(authenticateToken);

// Send message
router.post(
  '/',
  [
    body('conversationId').isMongoId().withMessage('Valid conversationId is required'),
    body('messageType')
      .optional()
      .isIn(['text', 'image', 'video', 'audio', 'document'])
      .withMessage('Invalid messageType'),
    body('text').optional({ nullable: true, checkFalsy: true }),
    body('media').optional({ nullable: true }),
    body('replyTo')
      .optional({ nullable: true, checkFalsy: true })
      .custom((value) => {
        if (!value) return true;
        if (!/^[0-9a-fA-F]{24}$/.test(value)) {
          throw new Error('replyTo must be a valid message ID');
        }
        return true;
      }),
    body('idempotencyKey').optional({ nullable: true, checkFalsy: true }).isString().trim(),
  ],
  validate,
  messageController.sendMessage
);

// Get messages for a conversation (cursor pagination)
router.get(
  '/:conversationId',
  [
    param('conversationId').isMongoId().withMessage('Valid conversationId is required'),
    query('cursor').optional().isISO8601().withMessage('Cursor must be a valid ISO8601 date string'),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  validate,
  messageController.getMessages
);

// Edit message text
router.put(
  '/:id',
  [
    param('id').isMongoId().withMessage('Valid message ID is required'),
    body('text').trim().notEmpty().withMessage('Updated text cannot be empty'),
  ],
  validate,
  messageController.editMessage
);

// Delete message
router.delete(
  '/:id',
  [
    param('id').isMongoId().withMessage('Valid message ID is required'),
    body('deleteForEveryone').optional().isBoolean().toBoolean(),
  ],
  validate,
  messageController.deleteMessage
);

// Add / toggle reaction
router.post(
  '/:id/reactions',
  [
    param('id').isMongoId().withMessage('Valid message ID is required'),
    body('emoji').trim().notEmpty().withMessage('Emoji is required'),
  ],
  validate,
  messageController.addReaction
);

// Mark messages as read
router.post(
  '/:id/read',
  [param('id').isMongoId().withMessage('Valid message ID is required')],
  validate,
  messageController.markAsRead
);

module.exports = router;
