const User = require('../models/user.model');
const RefreshToken = require('../models/refreshToken.model');
const socketService = require('../services/socket.service');

/**
 * GET /api/users/search
 * Searches users by username or email. Excludes requesting user and blocked relationships.
 */
const searchUsers = async (req, res, next) => {
  try {
    const { q, page = 1, limit = 20 } = req.query;

    if (!q || !q.trim()) {
      return res.status(200).json({
        success: true,
        users: [],
        pagination: { page: Number(page), limit: Number(limit), total: 0, pages: 0 },
      });
    }

    const currentUserId = req.user.id;
    const currentUser = await User.findById(currentUserId).select('blockedUsers');
    const myBlocked = currentUser ? currentUser.blockedUsers : [];

    // Find users who have blocked the requesting user
    const usersWhoBlockedMe = await User.find({ blockedUsers: currentUserId }).select('_id');
    const excludedIds = [currentUserId, ...myBlocked, ...usersWhoBlockedMe.map((u) => u._id)];

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const escapedQuery = q.trim().replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    const searchQuery = {
      _id: { $nin: excludedIds },
      $or: [
        { username: { $regex: escapedQuery, $options: 'i' } },
        { email: { $regex: escapedQuery, $options: 'i' } },
      ],
    };

    const [users, total] = await Promise.all([
      User.find(searchQuery)
        .select('username profilePicture bio isOnline lastSeen')
        .skip(skip)
        .limit(limitNum)
        .lean(),
      User.countDocuments(searchQuery),
    ]);

    return res.status(200).json({
      success: true,
      users,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/users/:id
 * Retrieves public profile by user ID.
 */
const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).select('username profilePicture bio isOnline lastSeen');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/users/profile
 * Updates authenticated user's profile.
 */
const updateProfile = async (req, res, next) => {
  try {
    const { username, bio, profilePicture } = req.body;
    const currentUserId = req.user.id;

    const user = await User.findById(currentUserId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    if (username && username.trim() !== user.username) {
      const cleanUsername = username.trim();
      const existing = await User.findOne({ username: cleanUsername, _id: { $ne: currentUserId } });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'Username is already taken',
          code: 'USERNAME_TAKEN',
        });
      }
      user.username = cleanUsername;
    }

    if (typeof bio === 'string') {
      user.bio = bio.trim();
    }

    if (profilePicture && typeof profilePicture === 'object') {
      user.profilePicture = {
        url: typeof profilePicture.url === 'string' ? profilePicture.url : user.profilePicture.url,
        fileId: typeof profilePicture.fileId === 'string' ? profilePicture.fileId : user.profilePicture.fileId,
      };
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profilePicture: user.profilePicture,
        bio: user.bio,
        isOnline: user.isOnline,
        lastSeen: user.lastSeen,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/users/change-password
 * Verifies current password, updates to new password, revokes sessions.
 */
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required',
        code: 'MISSING_PASSWORD_FIELDS',
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters long',
        code: 'WEAK_PASSWORD',
      });
    }

    const user = await User.findById(req.user.id).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect',
        code: 'INVALID_CREDENTIALS',
      });
    }

    // Set new password (pre-save hook will hash it with cost 12)
    user.password = newPassword;
    await user.save();

    // Revoke all existing refresh tokens
    await RefreshToken.updateMany(
      { userId: user._id, isRevoked: false },
      {
        $set: {
          isRevoked: true,
          revokedAt: new Date(),
          revokedReason: 'Password changed by user',
        },
      }
    );

    // Notify connected sockets to terminate session
    socketService.emitToUser(user._id, 'session:revoked', {
      reason: 'Password was changed. Please log in again.',
    });

    return res.status(200).json({
      success: true,
      message: 'Password updated successfully. All other active sessions have been invalidated.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/users/blocked
 * Retrieves list of blocked users for authenticated user.
 */
const getBlockedUsers = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).populate(
      'blockedUsers',
      'username profilePicture isOnline lastSeen'
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    return res.status(200).json({
      success: true,
      blockedUsers: user.blockedUsers || [],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/users/block/:id
 * Blocks a user.
 */
const blockUser = async (req, res, next) => {
  try {
    const targetUserId = req.params.id;
    const currentUserId = req.user.id;

    if (targetUserId === currentUserId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot block yourself',
        code: 'INVALID_OPERATION',
      });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User to block not found',
        code: 'USER_NOT_FOUND',
      });
    }

    await User.findByIdAndUpdate(currentUserId, {
      $addToSet: { blockedUsers: targetUserId },
    });

    return res.status(200).json({
      success: true,
      message: 'User blocked successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/users/unblock/:id
 * Unblocks a previously blocked user.
 */
const unblockUser = async (req, res, next) => {
  try {
    const targetUserId = req.params.id;
    const currentUserId = req.user.id;

    await User.findByIdAndUpdate(currentUserId, {
      $pull: { blockedUsers: targetUserId },
    });

    return res.status(200).json({
      success: true,
      message: 'User unblocked successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  searchUsers,
  getUserById,
  updateProfile,
  changePassword,
  getBlockedUsers,
  blockUser,
  unblockUser,
};
