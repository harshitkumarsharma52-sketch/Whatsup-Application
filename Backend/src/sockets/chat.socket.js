const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const Conversation = require('../models/conversation.model');
const Message = require('../models/message.model');
const socketService = require('../services/socket.service');
const imageKitService = require('../services/imagekit.service');

// Sliding window rate limiter for socket messages: max 60 messages/minute per socket
const checkSocketRateLimit = (socket) => {
  const now = Date.now();
  if (!socket.rateLimitWindow) {
    socket.rateLimitWindow = [];
  }
  // Keep only timestamps within the last 60 seconds
  socket.rateLimitWindow = socket.rateLimitWindow.filter((timestamp) => now - timestamp < 60000);

  if (socket.rateLimitWindow.length >= 60) {
    return false; // Rate limit exceeded
  }

  socket.rateLimitWindow.push(now);
  return true;
};

const initChatSocket = (io) => {
  // Authentication Middleware for Socket.IO
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '') ||
        socket.handshake.query?.token;

      if (!token) {
        return next(new Error('Authentication error: Missing token'));
      }

      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET, {
        algorithms: ['HS256'],
      });

      const user = await User.findById(decoded.id).select('_id username email');
      if (!user) {
        return next(new Error('Authentication error: User no longer exists'));
      }

      socket.user = {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
      };

      next();
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return next(new Error('Authentication error: Token expired'));
      }
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.user.id;
    socketService.setUserSocketId(userId, socket.id);

    // Join personal room for targeted emits
    socket.join(`user:${userId}`);

    try {
      // Mark user online in DB
      await User.findByIdAndUpdate(userId, {
        isOnline: true,
        lastSeen: new Date(),
      });

      // Join all conversation rooms the user belongs to
      const userConversations = await Conversation.find({
        participants: userId,
      }).select('_id');

      userConversations.forEach((conv) => {
        socket.join(conv._id.toString());
      });

      // Notify contacts / active rooms that this user is online
      io.emit('user:online', {
        userId,
        isOnline: true,
      });
    } catch (err) {
      console.error(`[Socket] Connection setup error for user ${userId}:`, err.message);
    }

    // EVENT: message:send
    socket.on('message:send', async (payload, callback) => {
      try {
        if (!checkSocketRateLimit(socket)) {
          const errPayload = {
            success: false,
            message: 'Rate limit exceeded: Maximum 60 messages per minute allowed.',
            code: 'RATE_LIMIT_EXCEEDED',
          };
          socket.emit('error:rate_limit', errPayload);
          if (typeof callback === 'function') callback(errPayload);
          return;
        }

        const { conversationId, text, media, messageType = 'text', replyTo, idempotencyKey } = payload || {};

        if (!conversationId) {
          const errPayload = { success: false, message: 'conversationId is required' };
          if (typeof callback === 'function') callback(errPayload);
          return;
        }

        // Verify conversation existence and user membership
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          const errPayload = { success: false, message: 'Conversation not found' };
          if (typeof callback === 'function') callback(errPayload);
          return;
        }

        if (!conversation.isParticipant(userId)) {
          const errPayload = { success: false, message: 'You are not a participant in this conversation' };
          if (typeof callback === 'function') callback(errPayload);
          return;
        }

        // Check idempotency to prevent duplicate message saves
        if (idempotencyKey) {
          const existingMessage = await Message.findOne({ idempotencyKey })
            .populate('sender', 'username profilePicture isOnline')
            .populate('replyTo', 'text sender messageType media');
          if (existingMessage) {
            if (typeof callback === 'function') {
              callback({ success: true, message: existingMessage, isDuplicate: true });
            }
            return;
          }
        }

        // Validate payload content
        if (messageType === 'text' && (!text || !text.trim())) {
          const errPayload = { success: false, message: 'Message text cannot be empty for text messages' };
          if (typeof callback === 'function') callback(errPayload);
          return;
        }

        if (['image', 'video', 'audio', 'document'].includes(messageType) && (!media || !media.url)) {
          const errPayload = { success: false, message: `Media URL required for message type ${messageType}` };
          if (typeof callback === 'function') callback(errPayload);
          return;
        }

        // Verify replyTo message if supplied
        let validReplyTo = null;
        if (replyTo) {
          const parentMsg = await Message.findOne({
            _id: replyTo,
            conversation: conversationId,
          });
          if (parentMsg) {
            validReplyTo = parentMsg._id;
          }
        }

        // Create new message with verified sender (never trusting client)
        const newMessage = await Message.create({
          conversation: conversationId,
          sender: userId,
          messageType,
          text: text ? text.trim() : '',
          media: media || undefined,
          replyTo: validReplyTo,
          idempotencyKey: idempotencyKey || undefined,
          status: 'sent',
        });

        // Update conversation: set lastMessage and increment unread counts for all other participants
        const updates = {
          lastMessage: newMessage._id,
        };

        conversation.participants.forEach((p) => {
          const pId = p.toString();
          if (pId !== userId) {
            const currentCount = conversation.unreadCounts.get(pId) || 0;
            conversation.unreadCounts.set(pId, currentCount + 1);
          }
        });

        conversation.lastMessage = newMessage._id;
        await conversation.save();

        const populatedMessage = await Message.findById(newMessage._id)
          .populate('sender', 'username profilePicture isOnline')
          .populate('replyTo', 'text sender messageType media');

        // Broadcast to all sockets in this conversation room
        io.to(conversationId).emit('message:new', populatedMessage);

        // Acknowledge delivery to sender
        socket.emit('message:delivered', {
          messageId: newMessage._id,
          conversationId,
          deliveredAt: new Date(),
        });

        if (typeof callback === 'function') {
          callback({ success: true, message: populatedMessage });
        }
      } catch (err) {
        console.error('[Socket] message:send error:', err);
        const errPayload = { success: false, message: err.message || 'Failed to send message' };
        if (typeof callback === 'function') callback(errPayload);
      }
    });

    // EVENT: message:read
    socket.on('message:read', async (payload, callback) => {
      try {
        const { conversationId, messageIds } = payload || {};
        if (!conversationId) {
          if (typeof callback === 'function') callback({ success: false, message: 'conversationId required' });
          return;
        }

        const conversation = await Conversation.findById(conversationId);
        if (!conversation || !conversation.isParticipant(userId)) {
          if (typeof callback === 'function') callback({ success: false, message: 'Unauthorized' });
          return;
        }

        const filter = {
          conversation: conversationId,
          sender: { $ne: userId },
          status: { $ne: 'read' },
        };

        if (Array.isArray(messageIds) && messageIds.length > 0) {
          filter._id = { $in: messageIds };
        }

        const readAt = new Date();
        const updateResult = await Message.updateMany(filter, {
          $set: {
            status: 'read',
            readAt,
          },
        });

        // Reset unread count for current user
        if (conversation.unreadCounts.has(userId)) {
          conversation.unreadCounts.set(userId, 0);
          await conversation.save();
        }

        const receipt = {
          conversationId,
          userId,
          readAt,
          count: updateResult.modifiedCount,
          messageIds: messageIds || [],
        };

        io.to(conversationId).emit('message:read', receipt);

        if (typeof callback === 'function') {
          callback({ success: true, ...receipt });
        }
      } catch (err) {
        console.error('[Socket] message:read error:', err);
        if (typeof callback === 'function') callback({ success: false, message: err.message });
      }
    });

    // EVENT: message:delete
    socket.on('message:delete', async (payload, callback) => {
      try {
        const { messageId, deleteForEveryone = false } = payload || {};
        if (!messageId) {
          if (typeof callback === 'function') callback({ success: false, message: 'messageId required' });
          return;
        }

        const message = await Message.findById(messageId);
        if (!message) {
          if (typeof callback === 'function') callback({ success: false, message: 'Message not found' });
          return;
        }

        const conversation = await Conversation.findById(message.conversation);
        if (!conversation || !conversation.isParticipant(userId)) {
          if (typeof callback === 'function') callback({ success: false, message: 'Unauthorized' });
          return;
        }

        if (deleteForEveryone) {
          // Only sender can delete for everyone
          if (message.sender.toString() !== userId) {
            if (typeof callback === 'function') {
              callback({ success: false, message: 'Only sender can delete for everyone' });
            }
            return;
          }

          // Delete media from ImageKit if exists
          if (message.media && message.media.fileId) {
            await imageKitService.deleteMedia(message.media.fileId);
          }

          message.isDeleted = true;
          message.text = 'This message was deleted';
          message.media = undefined;
          await message.save();

          io.to(message.conversation.toString()).emit('message:deleted', {
            messageId: message._id,
            conversationId: message.conversation,
            isDeleted: true,
            text: message.text,
          });
        } else {
          // Soft delete for the calling user only
          if (!message.deletedFor.includes(userId)) {
            message.deletedFor.push(userId);
            await message.save();
          }

          // Emit only to user's connected sockets
          socketService.emitToUser(userId, 'message:deleted', {
            messageId: message._id,
            conversationId: message.conversation,
            deletedForUser: userId,
          });
        }

        if (typeof callback === 'function') {
          callback({ success: true, messageId });
        }
      } catch (err) {
        console.error('[Socket] message:delete error:', err);
        if (typeof callback === 'function') callback({ success: false, message: err.message });
      }
    });

    // EVENT: message:edit
    socket.on('message:edit', async (payload, callback) => {
      try {
        const { messageId, text } = payload || {};
        if (!messageId || !text || !text.trim()) {
          if (typeof callback === 'function') {
            callback({ success: false, message: 'messageId and non-empty text required' });
          }
          return;
        }

        const message = await Message.findById(messageId);
        if (!message) {
          if (typeof callback === 'function') callback({ success: false, message: 'Message not found' });
          return;
        }

        // Validate sender ownership
        if (message.sender.toString() !== userId) {
          if (typeof callback === 'function') {
            callback({ success: false, message: 'You can only edit your own messages' });
          }
          return;
        }

        if (message.isDeleted) {
          if (typeof callback === 'function') {
            callback({ success: false, message: 'Cannot edit deleted messages' });
          }
          return;
        }

        if (message.messageType !== 'text') {
          if (typeof callback === 'function') {
            callback({ success: false, message: 'Only text messages can be edited' });
          }
          return;
        }

        message.text = text.trim();
        message.editedAt = new Date();
        await message.save();

        const populated = await Message.findById(message._id)
          .populate('sender', 'username profilePicture isOnline')
          .populate('replyTo', 'text sender messageType media');

        io.to(message.conversation.toString()).emit('message:edited', populated);

        if (typeof callback === 'function') {
          callback({ success: true, message: populated });
        }
      } catch (err) {
        console.error('[Socket] message:edit error:', err);
        if (typeof callback === 'function') callback({ success: false, message: err.message });
      }
    });

    // EVENT: typing:start
    socket.on('typing:start', async ({ conversationId }) => {
      if (!conversationId) return;
      socket.to(conversationId).emit('typing:start', {
        conversationId,
        userId,
        username: socket.user.username,
      });
    });

    // EVENT: typing:stop
    socket.on('typing:stop', async ({ conversationId }) => {
      if (!conversationId) return;
      socket.to(conversationId).emit('typing:stop', {
        conversationId,
        userId,
        username: socket.user.username,
      });
    });

    // EVENT: group:join
    socket.on('group:join', async ({ conversationId }, callback) => {
      try {
        if (!conversationId) return;
        const conversation = await Conversation.findById(conversationId);
        if (!conversation || !conversation.isParticipant(userId)) {
          if (typeof callback === 'function') {
            callback({ success: false, message: 'Unauthorized or group not found' });
          }
          return;
        }

        socket.join(conversationId);
        if (typeof callback === 'function') {
          callback({ success: true, conversationId });
        }
      } catch (err) {
        if (typeof callback === 'function') callback({ success: false, message: err.message });
      }
    });

    // EVENT: disconnect
    socket.on('disconnect', async () => {
      const isCompletelyOffline = socketService.removeUserSocketId(userId, socket.id);

      if (isCompletelyOffline) {
        const lastSeen = new Date();
        try {
          await User.findByIdAndUpdate(userId, {
            isOnline: false,
            lastSeen,
          });

          io.emit('user:offline', {
            userId,
            isOnline: false,
            lastSeen,
          });
        } catch (err) {
          console.error(`[Socket] Disconnect update error for user ${userId}:`, err.message);
        }
      }
    });
  });
};

module.exports = initChatSocket;
