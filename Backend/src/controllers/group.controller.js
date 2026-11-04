const Conversation = require('../models/conversation.model');
const Message = require('../models/message.model');
const User = require('../models/user.model');
const socketService = require('../services/socket.service');

/**
 * POST /api/groups
 * Creates a new group conversation with creator as admin.
 */
const createGroup = async (req, res, next) => {
  try {
    const { groupName, groupDescription = '', groupImage, participantIds = [] } = req.body;
    const currentUserId = req.user.id;

    if (!groupName || !groupName.trim()) {
      return res.status(400).json({
        success: false,
        message: 'groupName is required',
        code: 'MISSING_GROUP_NAME',
      });
    }

    if (!Array.isArray(participantIds) || participantIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one participant must be added to create a group',
        code: 'MISSING_PARTICIPANTS',
      });
    }

    // Filter unique participants and exclude creator if passed
    const cleanIds = Array.from(
      new Set(participantIds.map((id) => id.toString()).filter((id) => id !== currentUserId))
    );

    // Validate all participants exist
    const existingUsers = await User.find({ _id: { $in: cleanIds } }).select('_id');
    if (existingUsers.length !== cleanIds.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more participant IDs are invalid or do not exist',
        code: 'INVALID_PARTICIPANTS',
      });
    }

    const allParticipantIds = [currentUserId, ...cleanIds];

    const unreadCounts = new Map();
    allParticipantIds.forEach((id) => {
      unreadCounts.set(id, 0);
    });

    const newGroup = await Conversation.create({
      participants: allParticipantIds,
      isGroup: true,
      groupName: groupName.trim(),
      groupDescription: groupDescription.trim(),
      groupImage: groupImage || { url: '', fileId: '' },
      admins: [currentUserId],
      createdBy: currentUserId,
      unreadCounts,
    });

    // Create system message for group creation
    const creatorUser = await User.findById(currentUserId).select('username');
    const systemMsg = await Message.create({
      conversation: newGroup._id,
      sender: currentUserId,
      messageType: 'system',
      text: `${creatorUser ? creatorUser.username : 'User'} created group "${groupName.trim()}"`,
    });

    newGroup.lastMessage = systemMsg._id;
    await newGroup.save();

    const populatedGroup = await Conversation.findById(newGroup._id)
      .populate('participants', 'username profilePicture bio isOnline lastSeen')
      .populate('admins', 'username profilePicture bio')
      .populate('lastMessage')
      .populate('createdBy', 'username');

    // Notify all participants through sockets
    allParticipantIds.forEach((pId) => {
      socketService.emitToUser(pId, 'group:created', populatedGroup);
    });

    return res.status(201).json({
      success: true,
      group: populatedGroup,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/groups/:id
 * Updates group settings (name, description, image). Admin only.
 */
const updateGroup = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { groupName, groupDescription, groupImage } = req.body;
    const currentUserId = req.user.id;

    const group = await Conversation.findById(id);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found',
        code: 'GROUP_NOT_FOUND',
      });
    }

    if (!group.isGroup) {
      return res.status(400).json({
        success: false,
        message: 'This conversation is not a group',
        code: 'NOT_A_GROUP',
      });
    }

    if (!group.isAdmin(currentUserId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Only group admins can update group details',
        code: 'FORBIDDEN',
      });
    }

    if (groupName && groupName.trim()) {
      group.groupName = groupName.trim();
    }

    if (typeof groupDescription === 'string') {
      group.groupDescription = groupDescription.trim();
    }

    if (groupImage && typeof groupImage === 'object') {
      group.groupImage = {
        url: groupImage.url || group.groupImage.url,
        fileId: groupImage.fileId || group.groupImage.fileId,
      };
    }

    await group.save();

    const updated = await Conversation.findById(group._id)
      .populate('participants', 'username profilePicture bio isOnline lastSeen')
      .populate('admins', 'username profilePicture bio')
      .populate('lastMessage');

    try {
      const io = socketService.getIO();
      io.to(id).emit('group:updated', updated);
    } catch {}

    return res.status(200).json({
      success: true,
      message: 'Group updated successfully',
      group: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/groups/:id/members
 * Adds members to a group. Admin only.
 */
const addMembers = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { memberIds } = req.body;
    const currentUserId = req.user.id;

    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'memberIds must be a non-empty array',
        code: 'MISSING_MEMBER_IDS',
      });
    }

    const group = await Conversation.findById(id);
    if (!group || !group.isGroup) {
      return res.status(404).json({
        success: false,
        message: 'Group not found',
        code: 'GROUP_NOT_FOUND',
      });
    }

    if (!group.isAdmin(currentUserId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Only group admins can add members',
        code: 'FORBIDDEN',
      });
    }

    // Filter only users not already in group
    const existingParticipantSet = new Set(group.participants.map((p) => p.toString()));
    const newMemberIds = memberIds.filter((mid) => !existingParticipantSet.has(mid.toString()));

    if (newMemberIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'All specified users are already members of this group',
        code: 'MEMBERS_ALREADY_IN_GROUP',
      });
    }

    // Verify all new users exist
    const usersToAdd = await User.find({ _id: { $in: newMemberIds } }).select('_id username');
    if (usersToAdd.length !== newMemberIds.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more user IDs do not exist',
        code: 'USER_NOT_FOUND',
      });
    }

    usersToAdd.forEach((u) => {
      group.participants.push(u._id);
      group.unreadCounts.set(u._id.toString(), 0);
    });

    // Create system message
    const names = usersToAdd.map((u) => u.username).join(', ');
    const systemMsg = await Message.create({
      conversation: group._id,
      sender: currentUserId,
      messageType: 'system',
      text: `${req.user.email} added ${names} to the group`,
    });

    group.lastMessage = systemMsg._id;
    await group.save();

    const updated = await Conversation.findById(group._id)
      .populate('participants', 'username profilePicture bio isOnline lastSeen')
      .populate('admins', 'username profilePicture bio')
      .populate('lastMessage');

    try {
      const io = socketService.getIO();
      io.to(id).emit('group:members_added', {
        group: updated,
        addedMembers: usersToAdd,
      });

      // Notify new members directly so they join room
      newMemberIds.forEach((mid) => {
        socketService.emitToUser(mid, 'group:invited', updated);
      });
    } catch {}

    return res.status(200).json({
      success: true,
      message: 'Members added successfully',
      group: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/groups/:id/members/:userId
 * Removes a member from group. Admin or self-remove only.
 */
const removeMember = async (req, res, next) => {
  try {
    const { id, userId } = req.params;
    const currentUserId = req.user.id;

    const group = await Conversation.findById(id);
    if (!group || !group.isGroup) {
      return res.status(404).json({
        success: false,
        message: 'Group not found',
        code: 'GROUP_NOT_FOUND',
      });
    }

    const isAdmin = group.isAdmin(currentUserId);
    const isSelf = currentUserId === userId;

    if (!isAdmin && !isSelf) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Only admins can remove other members',
        code: 'FORBIDDEN',
      });
    }

    if (!group.isParticipant(userId)) {
      return res.status(400).json({
        success: false,
        message: 'User is not a member of this group',
        code: 'NOT_A_MEMBER',
      });
    }

    // Remove from participants and admins
    group.participants = group.participants.filter((p) => p.toString() !== userId);
    group.admins = group.admins.filter((a) => a.toString() !== userId);
    group.unreadCounts.delete(userId);

    // If no participants remain, delete the group
    if (group.participants.length === 0) {
      await Message.deleteMany({ conversation: group._id });
      await Conversation.findByIdAndDelete(group._id);

      return res.status(200).json({
        success: true,
        message: 'Group dissolved as no participants remain',
      });
    }

    // If an admin left and no admins remain, promote first participant
    if (group.admins.length === 0 && group.participants.length > 0) {
      group.admins.push(group.participants[0]);
    }

    const removedUser = await User.findById(userId).select('username');
    const systemMsg = await Message.create({
      conversation: group._id,
      sender: currentUserId,
      messageType: 'system',
      text: isSelf
        ? `${removedUser?.username || 'A member'} left the group`
        : `${removedUser?.username || 'A member'} was removed from the group`,
    });

    group.lastMessage = systemMsg._id;
    await group.save();

    try {
      const io = socketService.getIO();
      io.to(id).emit('group:member_removed', {
        groupId: id,
        userId,
        systemMessage: systemMsg,
      });

      socketService.emitToUser(userId, 'group:removed_self', { groupId: id });
    } catch {}

    return res.status(200).json({
      success: true,
      message: 'Member removed successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/groups/:id/leave
 * Allows authenticated user to leave a group.
 * If user was the only admin, automatically promotes the next member or dissolves if empty.
 */
const leaveGroup = async (req, res, next) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user.id;

    const group = await Conversation.findById(id);
    if (!group || !group.isGroup) {
      return res.status(404).json({
        success: false,
        message: 'Group not found',
        code: 'GROUP_NOT_FOUND',
      });
    }

    if (!group.isParticipant(currentUserId)) {
      return res.status(400).json({
        success: false,
        message: 'You are not a member of this group',
        code: 'NOT_A_MEMBER',
      });
    }

    group.participants = group.participants.filter((p) => p.toString() !== currentUserId);
    group.admins = group.admins.filter((a) => a.toString() !== currentUserId);
    group.unreadCounts.delete(currentUserId);

    // If no participants remain, dissolve group
    if (group.participants.length === 0) {
      await Message.deleteMany({ conversation: group._id });
      await Conversation.findByIdAndDelete(group._id);

      return res.status(200).json({
        success: true,
        message: 'Left group. Group dissolved as no members remain.',
      });
    }

    // If no admin left, promote next remaining member
    if (group.admins.length === 0 && group.participants.length > 0) {
      group.admins.push(group.participants[0]);
    }

    const leavingUser = await User.findById(currentUserId).select('username');
    const systemMsg = await Message.create({
      conversation: group._id,
      sender: currentUserId,
      messageType: 'system',
      text: `${leavingUser?.username || 'A member'} left the group`,
    });

    group.lastMessage = systemMsg._id;
    await group.save();

    try {
      const io = socketService.getIO();
      io.to(id).emit('group:member_left', {
        groupId: id,
        userId: currentUserId,
        systemMessage: systemMsg,
      });
    } catch {}

    return res.status(200).json({
      success: true,
      message: 'You have left the group successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/groups/:id
 * Retrieves group info and members list.
 */
const getGroupInfo = async (req, res, next) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user.id;

    const group = await Conversation.findById(id)
      .populate('participants', 'username profilePicture bio isOnline lastSeen')
      .populate('admins', 'username profilePicture bio')
      .populate('createdBy', 'username');

    if (!group || !group.isGroup) {
      return res.status(404).json({
        success: false,
        message: 'Group not found',
        code: 'GROUP_NOT_FOUND',
      });
    }

    if (!group.isParticipant(currentUserId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not a member of this group',
        code: 'FORBIDDEN',
      });
    }

    return res.status(200).json({
      success: true,
      group,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createGroup,
  updateGroup,
  addMembers,
  removeMember,
  leaveGroup,
  getGroupInfo,
};
