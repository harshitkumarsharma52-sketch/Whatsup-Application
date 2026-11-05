const Message = require('../models/message.model');
const Conversation = require('../models/conversation.model');
const socketService = require('../services/socket.service');
const imageKitService = require('../services/imagekit.service');

/**
 * POST /api/messages
 * Sends a message in a conversation.
 * Sender is ALWAYS taken strictly from req.user.id.
 */
const sendMessage = async (req, res, next) => {
  try {
    const { conversationId, text, media, messageType = 'text', replyTo, idempotencyKey } = req.body;
    const senderId = req.user.id;

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        message: 'conversationId is required',
        code: 'MISSING_CONVERSATION_ID',
      });
    }

    // Verify conversation existence and user membership
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found',
        code: 'CONVERSATION_NOT_FOUND',
      });
    }

    if (!conversation.isParticipant(senderId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not a participant in this conversation',
        code: 'FORBIDDEN',
      });
    }

    // Idempotency check: prevent duplicate message submissions
    if (idempotencyKey) {
      const existing = await Message.findOne({ idempotencyKey, conversation: conversationId, sender: senderId })
        .populate('sender', 'username profilePicture isOnline')
        .populate({
          path: 'replyTo',
          populate: { path: 'sender', select: 'username' },
        });

      if (existing) {
        return res.status(200).json({
          success: true,
          message: existing,
          isDuplicate: true,
        });
      }
    }

    // Validate content based on messageType
    if (messageType === 'text' && (!text || !text.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Message text is required for text messages',
        code: 'EMPTY_MESSAGE_TEXT',
      });
    }

    if (['image', 'video', 'audio', 'document'].includes(messageType) && (!media || !media.url)) {
      return res.status(400).json({
        success: false,
        message: `Media object with url is required for ${messageType} message`,
        code: 'MEDIA_REQUIRED',
      });
    }

    // Verify replyTo message belongs to this conversation if provided
    let verifiedReplyTo = null;
    if (replyTo) {
      const replyMessage = await Message.findOne({
        _id: replyTo,
        conversation: conversationId,
      });
      if (replyMessage) {
        verifiedReplyTo = replyMessage._id;
      }
    }

    // Create message with verified sender
    const newMessage = await Message.create({
      conversation: conversationId,
      sender: senderId,
      messageType,
      text: text ? text.trim() : '',
      media: media || undefined,
      replyTo: verifiedReplyTo,
      idempotencyKey: idempotencyKey || undefined,
      status: 'sent',
    });

    // Update conversation lastMessage & increment unread counts
    conversation.lastMessage = newMessage._id;
    conversation.participants.forEach((p) => {
      const pId = p.toString();
      if (pId !== senderId) {
        const count = conversation.unreadCounts.get(pId) || 0;
        conversation.unreadCounts.set(pId, count + 1);
      }
    });
    await conversation.save();

    const recipientIsOnline = conversation.participants.some(
      (participant) => participant.toString() !== senderId && socketService.isUserOnline(participant)
    );
    if (recipientIsOnline) {
      newMessage.status = 'delivered';
      newMessage.deliveredAt = new Date();
      await newMessage.save();
    }

    const populatedMessage = await Message.findById(newMessage._id)
      .populate('sender', 'username profilePicture isOnline')
      .populate({
        path: 'replyTo',
        populate: { path: 'sender', select: 'username' },
      });

    // Broadcast message via Socket.IO
    try {
      socketService.getIO();
      socketService.emitToConversationParticipants(conversation, 'newMessage', populatedMessage);
      if (recipientIsOnline) {
        socketService.emitToConversationParticipants(conversation, 'message:delivered', {
          messageId: populatedMessage._id,
          conversationId,
          deliveredAt: newMessage.deliveredAt,
        });
      }
      for (const participant of conversation.participants) {
        const participantId = participant.toString();
        if (participantId !== senderId) {
          socketService.emitToUser(participantId, 'conversation:unread', {
            conversationId,
            unreadCount: conversation.unreadCounts.get(participantId) || 0,
          });
        }
      }
    } catch {
      // Socket emission is non-blocking for HTTP response
    }

    return res.status(201).json({
      success: true,
      message: populatedMessage,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/messages/:conversationId
 * Cursor-based pagination of messages in a conversation.
 * Excludes messages marked as deleted for the requesting user.
 */
const getMessages = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { cursor, limit = 30 } = req.query;
    const currentUserId = req.user.id;

    const conversation = await Conversation.findById(conversationId);
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

    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const query = {
      conversation: conversationId,
      deletedFor: { $ne: currentUserId },
    };

    if (cursor) {
      query.createdAt = { $lt: new Date(cursor) };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(limitNum + 1)
      .populate('sender', 'username profilePicture isOnline')
      .populate({
        path: 'replyTo',
        populate: { path: 'sender', select: 'username' },
      })
      .populate('reactions.user', 'username profilePicture')
      .lean();

    const hasMore = messages.length > limitNum;
    if (hasMore) {
      messages.pop(); // Remove extra item used for cursor detection
    }

    const nextCursor = hasMore && messages.length > 0 ? messages[messages.length - 1].createdAt : null;

    return res.status(200).json({
      success: true,
      messages: messages.reverse(), // Chronological order
      nextCursor,
      hasMore,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/messages/:id
 * Edits the text of a message.
 * Sender ownership and text type strictly verified.
 */
const editMessage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { text } = req.body;
    const currentUserId = req.user.id;

    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Updated message text cannot be empty',
        code: 'EMPTY_TEXT',
      });
    }

    const message = await Message.findById(id);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
        code: 'MESSAGE_NOT_FOUND',
      });
    }

    const conversation = await Conversation.findById(message.conversation);
    if (!conversation || !conversation.isParticipant(currentUserId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not a participant in this conversation',
        code: 'FORBIDDEN',
      });
    }

    if (message.sender.toString() !== currentUserId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You can only edit your own messages',
        code: 'FORBIDDEN',
      });
    }

    if (message.isDeleted) {
      return res.status(400).json({
        success: false,
        message: 'Cannot edit a deleted message',
        code: 'MESSAGE_DELETED',
      });
    }

    if (message.messageType !== 'text') {
      return res.status(400).json({
        success: false,
        message: 'Only text messages can be edited',
        code: 'INVALID_MESSAGE_TYPE',
      });
    }

    message.text = text.trim();
    message.editedAt = new Date();
    await message.save();

    const populated = await Message.findById(message._id)
      .populate('sender', 'username profilePicture isOnline')
      .populate({
        path: 'replyTo',
        populate: { path: 'sender', select: 'username' },
      });

    try {
      const io = socketService.getIO();
      io.to(message.conversation.toString()).emit('message:edited', populated);
    } catch {}

    return res.status(200).json({
      success: true,
      message: populated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/messages/:id
 * Deletes a message for user or for everyone.
 * If all participants deleted, media is removed from ImageKit and document pruned.
 */
const deleteMessage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { deleteForEveryone = false } = req.body;
    const currentUserId = req.user.id;

    const message = await Message.findById(id);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
        code: 'MESSAGE_NOT_FOUND',
      });
    }

    const conversation = await Conversation.findById(message.conversation);
    if (!conversation || !conversation.isParticipant(currentUserId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not a participant in this conversation',
        code: 'FORBIDDEN',
      });
    }

    if (deleteForEveryone) {
      // Must be sender to delete for everyone
      if (message.sender.toString() !== currentUserId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: Only the sender can delete a message for everyone',
          code: 'FORBIDDEN',
        });
      }

      // Delete media from ImageKit
      if (message.media && message.media.fileId) {
        await imageKitService.deleteMedia(message.media.fileId);
      }

      message.isDeleted = true;
      message.text = 'This message was deleted';
      message.media = undefined;
      await message.save();

      try {
        const io = socketService.getIO();
        io.to(message.conversation.toString()).emit('message:deleted', {
          messageId: message._id,
          conversationId: message.conversation,
          isDeleted: true,
          text: message.text,
        });
      } catch {}

      return res.status(200).json({
        success: true,
        message: 'Message deleted for everyone',
      });
    }

    // Soft delete for current user
    if (!message.deletedFor.some((id) => id.toString() === currentUserId)) {
      message.deletedFor.push(currentUserId);
    }

    // Check if every participant in conversation has now deleted this message
    const allDeleted = conversation.participants.every((p) =>
      message.deletedFor.some((delId) => delId.toString() === p.toString())
    );

    if (allDeleted) {
      // Hard delete file from ImageKit and remove message document
      if (message.media && message.media.fileId) {
        await imageKitService.deleteMedia(message.media.fileId);
      }
      await Message.findByIdAndDelete(message._id);
    } else {
      await message.save();
    }

    // Notify requesting user's sockets
    socketService.emitToUser(currentUserId, 'message:deleted', {
      messageId: message._id,
      conversationId: message.conversation,
      deletedForUser: currentUserId,
    });

    return res.status(200).json({
      success: true,
      message: 'Message deleted for you',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/messages/:id/reactions
 * Adds, updates, or toggles an emoji reaction.
 */
const addReaction = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { emoji } = req.body;
    const currentUserId = req.user.id;

    if (!emoji || !emoji.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Emoji is required',
        code: 'MISSING_EMOJI',
      });
    }

    const message = await Message.findById(id);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
        code: 'MESSAGE_NOT_FOUND',
      });
    }

    const conversation = await Conversation.findById(message.conversation);
    if (!conversation || !conversation.isParticipant(currentUserId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not a participant in this conversation',
        code: 'FORBIDDEN',
      });
    }

    const cleanEmoji = emoji.trim();
    const existingIndex = message.reactions.findIndex(
      (r) => r.user.toString() === currentUserId
    );

    if (existingIndex > -1) {
      if (message.reactions[existingIndex].emoji === cleanEmoji) {
        // Toggle reaction off
        message.reactions.splice(existingIndex, 1);
      } else {
        // Change reaction emoji
        message.reactions[existingIndex].emoji = cleanEmoji;
        message.reactions[existingIndex].createdAt = new Date();
      }
    } else {
      message.reactions.push({
        user: currentUserId,
        emoji: cleanEmoji,
        createdAt: new Date(),
      });
    }

    await message.save();

    const populatedMessage = await Message.findById(message._id)
      .populate('reactions.user', 'username profilePicture')
      .select('reactions conversation');

    try {
      const io = socketService.getIO();
      io.to(message.conversation.toString()).emit('message:reaction', {
        messageId: message._id,
        conversationId: message.conversation,
        reactions: populatedMessage.reactions,
      });
    } catch {}

    return res.status(200).json({
      success: true,
      reactions: populatedMessage.reactions,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/messages/:id/read
 * Marks messages up to this message in a conversation as read.
 */
const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user.id;

    const targetMessage = await Message.findById(id);
    if (!targetMessage) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
        code: 'MESSAGE_NOT_FOUND',
      });
    }

    const conversation = await Conversation.findById(targetMessage.conversation);
    if (!conversation || !conversation.isParticipant(currentUserId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not a participant in this conversation',
        code: 'FORBIDDEN',
      });
    }

    const readAt = new Date();

    // Mark target message and prior unread messages in this conversation as read
    const updateResult = await Message.updateMany(
      {
        conversation: conversation._id,
        sender: { $ne: currentUserId },
        createdAt: { $lte: targetMessage.createdAt },
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
    if (conversation.unreadCounts.has(currentUserId)) {
      conversation.unreadCounts.set(currentUserId, 0);
      await conversation.save();
    }

    const receipt = {
      conversationId: conversation._id,
      userId: currentUserId,
      lastReadMessageId: id,
      readAt,
      modifiedCount: updateResult.modifiedCount,
    };

    try {
      const io = socketService.getIO();
      io.to(conversation._id.toString()).emit('message:read', receipt);
    } catch {}

    socketService.emitToUser(currentUserId, 'conversation:unread', {
      conversationId: conversation._id,
      unreadCount: 0,
    });

    return res.status(200).json({
      success: true,
      ...receipt,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  sendMessage,
  getMessages,
  editMessage,
  deleteMessage,
  addReaction,
  markAsRead,
};
