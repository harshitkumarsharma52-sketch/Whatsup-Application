const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    isGroup: {
      type: Boolean,
      default: false,
    },
    groupName: {
      type: String,
      trim: true,
      default: '',
      maxlength: [100, 'Group name cannot exceed 100 characters'],
    },
    groupImage: {
      url: {
        type: String,
        default: '',
      },
      fileId: {
        type: String,
        default: '',
      },
    },
    groupDescription: {
      type: String,
      trim: true,
      default: '',
      maxlength: [500, 'Group description cannot exceed 500 characters'],
    },
    admins: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    unreadCounts: {
      type: Map,
      of: Number,
      default: () => new Map(),
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index on participants for fast lookups
conversationSchema.index({ participants: 1 });
conversationSchema.index({ updatedAt: -1 });

// Instance method: Get the other participant in a 1-to-1 conversation
conversationSchema.methods.getOtherParticipant = function (userId) {
  if (this.isGroup) {
    return null;
  }
  const targetId = userId.toString();
  const other = this.participants.find((p) => {
    const id = p._id ? p._id.toString() : p.toString();
    return id !== targetId;
  });
  return other || null;
};

// Instance method: Check if a user is a participant
conversationSchema.methods.isParticipant = function (userId) {
  if (!userId) return false;
  const targetId = userId.toString();
  return this.participants.some((p) => {
    const id = p._id ? p._id.toString() : p.toString();
    return id === targetId;
  });
};

// Instance method: Check if a user is an admin
conversationSchema.methods.isAdmin = function (userId) {
  if (!userId || !this.isGroup) return false;
  const targetId = userId.toString();
  return this.admins.some((a) => {
    const id = a._id ? a._id.toString() : a.toString();
    return id === targetId;
  });
};

const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = Conversation;
