const express = require('express');
const { body, param } = require('express-validator');
const conversationController = require('../controllers/conversation.controller');
const { authenticateToken } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');

const router = express.Router();

// Apply authentication middleware to all conversation routes
router.use(authenticateToken);

// Create or retrieve 1-to-1 conversation
router.post(
  '/',
  [body('recipientId').isMongoId().withMessage('Valid recipientId is required')],
  validate,
  conversationController.createOrGetPrivate
);

// Get all conversations for current user
router.get('/', conversationController.getConversations);

// Get single conversation by ID
router.get(
  '/:id',
  [param('id').isMongoId().withMessage('Valid conversation ID format is required')],
  validate,
  conversationController.getConversationById
);

// Update group conversation
router.put(
  '/:id',
  [
    param('id').isMongoId().withMessage('Valid conversation ID format is required'),
    body('groupName').optional().trim().isLength({ min: 1, max: 100 }),
    body('groupDescription').optional().trim().isLength({ max: 500 }),
    body('groupImage').optional().isObject(),
  ],
  validate,
  conversationController.updateConversation
);

// Soft delete conversation for current user
router.delete(
  '/:id',
  [param('id').isMongoId().withMessage('Valid conversation ID format is required')],
  validate,
  conversationController.deleteConversation
);

// Mark all messages in conversation as read
router.post(
  '/:id/read',
  [param('id').isMongoId().withMessage('Valid conversation ID format is required')],
  validate,
  conversationController.markConversationAsRead
);

module.exports = router;
