const express = require('express');
const { body, param } = require('express-validator');
const groupController = require('../controllers/group.controller');
const { authenticateToken } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');

const router = express.Router();

// Protect all group routes
router.use(authenticateToken);

// Create a new group
router.post(
  '/',
  [
    body('groupName').trim().notEmpty().withMessage('groupName is required'),
    body('groupDescription').optional().trim().isLength({ max: 500 }),
    body('groupImage').optional().isObject(),
    body('participantIds').isArray({ min: 1 }).withMessage('participantIds must be a non-empty array'),
    body('participantIds.*').isMongoId().withMessage('Each participantId must be a valid Mongo ID'),
  ],
  validate,
  groupController.createGroup
);

// Get group info
router.get(
  '/:id',
  [param('id').isMongoId().withMessage('Valid group ID is required')],
  validate,
  groupController.getGroupInfo
);

// Update group
router.put(
  '/:id',
  [
    param('id').isMongoId().withMessage('Valid group ID is required'),
    body('groupName').optional().trim().notEmpty().withMessage('groupName cannot be empty'),
    body('groupDescription').optional().trim().isLength({ max: 500 }),
    body('groupImage').optional().isObject(),
  ],
  validate,
  groupController.updateGroup
);

// Add members to group
router.post(
  '/:id/members',
  [
    param('id').isMongoId().withMessage('Valid group ID is required'),
    body('memberIds').isArray({ min: 1 }).withMessage('memberIds must be a non-empty array of IDs'),
    body('memberIds.*').isMongoId().withMessage('Each memberId must be a valid Mongo ID'),
  ],
  validate,
  groupController.addMembers
);

// Remove member from group
router.delete(
  '/:id/members/:userId',
  [
    param('id').isMongoId().withMessage('Valid group ID is required'),
    param('userId').isMongoId().withMessage('Valid userId is required'),
  ],
  validate,
  groupController.removeMember
);

// Leave group
router.post(
  '/:id/leave',
  [param('id').isMongoId().withMessage('Valid group ID is required')],
  validate,
  groupController.leaveGroup
);

module.exports = router;
