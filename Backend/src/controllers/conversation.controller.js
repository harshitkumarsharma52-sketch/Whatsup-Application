const Conversation = require('../models/conversation.model');
const Message = require('../models/message.model');
const User = require('../models/user.model');
const socketService = require('../services/socket.service');

/**
 * POST /api/conversations
 * Finds an existing 1-on-1 private conversation between two users or creates a new one.
 * Prevents duplicates by querying with $all and $size: 2.
 */
const createOrGetPrivate = async (req, res, next) => {
  try {
    const { recipientId } = req.body;
    const currentUserId = req.user.id;

    if (!recipientId) {
      return res.status(400).json({
        success: false,
        message: 'recipientId is required',
        code: 'MISSING_RECIPIENT_ID',
      });
    }

    if (recipientId === currentUserId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot create a private conversation with yourself',
        code: 'SELF_CONVERSATION_NOT_ALLOWED',
      });
    }

    const [recipient, currentUser] = await Promise.all([
      User.findById(recipientId),
      User.findById(currentUserId),
    ]);

    if (!recipient) {
      return res.status(404).json({
        success: false,
        message: 'Recipient user does not exist',
        code: 'USER_NOT_FOUND',
      });
    }

    // Check blocked relationships
    const isBlockedByMe = currentUser.blockedUsers?.some((id) => id.toString() === recipientId);
    const isBlockedByRecipient = recipient.blockedUsers?.some((id) => id.toString() === currentUserId);

    if (isBlockedByMe || isBlockedByRecipient) {
      return res.status(403).json({
        success: false,
        message: 'Cannot initiate conversation with a blocked user',
        code: 'USER_BLOCKED',
      });
    }

    // Look for existing private conversation
    let conversation = await Conversation.findOne({
      isGroup: false,
      participants: { $all: [currentUserId, recipientId], $size: 2 },
    })
      .populate('participants', 'username profilePicture bio isOnline lastSeen')
      .populate('lastMessage');

    if (conversation) {
      return res.status(200).json({
        success: true,
        conversation,
        isNew: false,
      });
    }

    // Create new conversation
    const unreadMap = new Map();
    unreadMap.set(currentUserId.toString(), 0);
    unreadMap.set(recipientId.toString(), 0);

    const newConversation = await Conversation.create({
      participants: [currentUserId, recipientId],
      isGroup: false,
      createdBy: currentUserId,
      unreadCounts: unreadMap,
    });

    conversation = await Conversation.findById(newConversation._id)
      .populate('participants', 'username profilePicture bio isOnline lastSeen')
      .populate('lastMessage');

    // Notify recipient via socket if connected
    socketService.emitToUser(recipientId, 'conversation:new', conversation);

    return res.status(201).json({
      success: true,
      conversation,
      isNew: true,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/conversations
 * Retrieves all conversations for the authenticated user, populated with lastMessage and participants.
 */
const getConversations = async (req, res, next) => {
  try {
    const currentUserId = req.user.id;

    const conversations = await Conversation.find({
      participants: currentUserId,
    })
      .populate('participants', 'username profilePicture bio isOnline lastSeen')
      .populate({
        path: 'lastMessage',
        populate: [
          { path: 'sender', select: 'username profilePicture' },
          { path: 'replyTo', select: 'text sender messageType' },
        ],
      })
      .populate('admins', 'username profilePicture')
      .sort({ updatedAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      conversations,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/conversations/:id
 * Retrieves a single conversation by ID if the authenticated user is a participant.
 */
const getConversationById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user.id;

    const conversation = await Conversation.findById(id)
      .populate('participants', 'username profilePicture bio isOnline lastSeen')
      .populate({
        path: 'lastMessage',
        populate: { path: 'sender', select: 'username profilePicture' },
      })
      .populate('admins', 'username profilePicture')
      .populate('createdBy', 'username');

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found',
        code: 'CONVERSATION_NOT_FOUND',
      });
    }

    if (!conversation.isParticipant(currentUserId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not a participant in this conversation',
        code: 'FORBIDDEN',
      });
    }

    return res.status(200).json({
      success: true,
      conversation,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/conversations/:id
 * Updates group conversation details (groupName, groupDescription, groupImage).
 * Allowed only for group admins.
 */
const updateConversation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user.id;
    const { groupName, groupDescription, groupImage } = req.body;

    const conversation = await Conversation.findById(id);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found',
        code: 'CONVERSATION_NOT_FOUND',
      });
    }

    if (!conversation.isGroup) {
      return res.status(400).json({
        success: false,
        message: 'Cannot update non-group conversation through this endpoint',
        code: 'NOT_A_GROUP',
      });
    }

    if (!conversation.isAdmin(currentUserId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Only group administrators can update group details',
        code: 'FORBIDDEN',
      });
    }

    if (groupName && groupName.trim()) {
      conversation.groupName = groupName.trim();
    }

    if (typeof groupDescription === 'string') {
      conversation.groupDescription = groupDescription.trim();
    }

    if (groupImage && typeof groupImage === 'object') {
      conversation.groupImage = {
        url: groupImage.url || conversation.groupImage.url,
        fileId: groupImage.fileId || conversation.groupImage.fileId,
      };
    }

    await conversation.save();

    const updated = await Conversation.findById(conversation._id)
      .populate('participants', 'username profilePicture bio isOnline lastSeen')
      .populate('admins', 'username profilePicture');

    // Emit update event to conversation room
    const io = socketService.getIO();
    io.to(id).emit('conversation:updated', updated);

    return res.status(200).json({
      success: true,
      message: 'Group conversation updated successfully',
      conversation: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/conversations/:id
 * Soft delete: clears messages and hides conversation for the requesting user.
 */
const deleteConversation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user.id;

    const conversation = await Conversation.findById(id);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found',
        code: 'CONVERSATION_NOT_FOUND',
      });
    }

    if (!conversation.isParticipant(currentUserId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not a participant in this conversation',
        code: 'FORBIDDEN',
      });
    }

    // Soft delete all messages in this conversation for the requesting user
    await Message.updateMany(
      {
        conversation: id,
        deletedFor: { $ne: currentUserId },
      },
      {
        $addToSet: { deletedFor: currentUserId },
      }
    );

    // Reset unread counts for this user
    if (conversation.unreadCounts.has(currentUserId)) {
      conversation.unreadCounts.set(currentUserId, 0);
      await conversation.save();
    }

    return res.status(200).json({
      success: true,
      message: 'Conversation cleared successfully for user',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/conversations/:id/read
 * Marks all messages in this conversation as read for the requesting user.
 */
const markConversationAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user.id;

    const conversation = await Conversation.findById(id);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found',
        code: 'CONVERSATION_NOT_FOUND',
      });
    }

    if (!conversation.isParticipant(currentUserId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not a participant in this conversation',
        code: 'FORBIDDEN',
      });
    }

    const readAt = new Date();

    // Mark all prior unread incoming messages as read
    await Message.updateMany(
      {
        conversation: id,
        sender: { $ne: currentUserId },
        status: { $ne: 'read' },
      },
      {
        $set: {
          status: 'read',
          readAt,
        },
      }
    );

    // Reset unread count for current user
    if (conversation.unreadCounts && conversation.unreadCounts.has(currentUserId)) {
      conversation.unreadCounts.set(currentUserId, 0);
      await conversation.save();
    }

    try {
      const io = socketService.getIO();
      io.to(id.toString()).emit('message:read', {
        conversationId: id,
        userId: currentUserId,
        readAt,
      });
    } catch {}

    return res.status(200).json({
      success: true,
      message: 'Conversation marked as read',
      conversationId: id,
      readAt,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createOrGetPrivate,
  getConversations,
  getConversationById,
  updateConversation,
  deleteConversation,
  markConversationAsRead,
};
