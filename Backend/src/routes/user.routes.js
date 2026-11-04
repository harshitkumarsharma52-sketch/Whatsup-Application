const express = require('express');
const { body, param, query } = require('express-validator');
const userController = require('../controllers/user.controller');
const { authenticateToken } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');

const router = express.Router();

// Apply authentication middleware to all user routes
router.use(authenticateToken);

// Search users
router.get(
  '/search',
  [
    query('q').trim().notEmpty().withMessage('Search query string "q" is required'),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
  ],
  validate,
  userController.searchUsers
);

// Get list of blocked users
router.get('/blocked', userController.getBlockedUsers);

// Get public profile by user ID
router.get(
  '/:id',
  [param('id').isMongoId().withMessage('Invalid user ID format')],
  validate,
  userController.getUserById
);

// Update user profile
router.put(
  '/profile',
  [
    body('username')
      .optional()
      .trim()
      .isLength({ min: 3, max: 30 })
      .withMessage('Username must be between 3 and 30 characters')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Username can only contain alphanumeric characters and underscores'),
    body('bio')
      .optional()
      .trim()
      .isLength({ max: 200 })
      .withMessage('Bio cannot exceed 200 characters'),
    body('profilePicture')
      .optional()
      .isObject()
      .withMessage('Profile picture must be an object with url and fileId'),
  ],
  validate,
  userController.updateProfile
);

// Change password
router.put(
  '/change-password',
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters long')
      .matches(/[A-Z]/)
      .withMessage('New password must contain at least one uppercase letter')
      .matches(/[0-9]/)
      .withMessage('New password must contain at least one number'),
  ],
  validate,
  userController.changePassword
);

// Block user
router.post(
  '/block/:id',
  [param('id').isMongoId().withMessage('Invalid user ID format')],
  validate,
  userController.blockUser
);

// Unblock user
router.post(
  '/unblock/:id',
  [param('id').isMongoId().withMessage('Invalid user ID format')],
  validate,
  userController.unblockUser
);

module.exports = router;
