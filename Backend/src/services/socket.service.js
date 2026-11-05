let ioInstance = null;

// Map storing userId -> Set of socketIds
const userSocketMap = new Map();

/**
 * Stores the Socket.IO server instance.
 * @param {Object} io - Socket.IO server instance
 */
const setIO = (io) => {
  ioInstance = io;
};

/**
 * Retrieves the Socket.IO server instance.
 * @returns {Object} io instance
 */
const getIO = () => {
  if (!ioInstance) {
    throw new Error('Socket.IO has not been initialized yet. Call setIO(io) first.');
  }
  return ioInstance;
};

/**
 * Maps a socket ID to a user ID.
 * @param {string} userId - User ID
 * @param {string} socketId - Socket ID
 */
const setUserSocketId = (userId, socketId) => {
  const uid = userId.toString();
  if (!userSocketMap.has(uid)) {
    userSocketMap.set(uid, new Set());
  }
  userSocketMap.get(uid).add(socketId);
};

/**
 * Removes a socket ID for a user.
 * @param {string} userId - User ID
 * @param {string} socketId - Socket ID
 * @returns {boolean} True if the user has no remaining active sockets (is now completely offline)
 */
const removeUserSocketId = (userId, socketId) => {
  const uid = userId.toString();
  if (!userSocketMap.has(uid)) return true;

  const sockets = userSocketMap.get(uid);
  sockets.delete(socketId);

  if (sockets.size === 0) {
    userSocketMap.delete(uid);
    return true; // No more active connections
  }
  return false;
};

/**
 * Gets active socket IDs for a given user.
 * @param {string} userId - User ID
 * @returns {string|null} First active socket ID, or null
 */
const getUserSocketId = (userId) => {
  const uid = userId.toString();
  const sockets = userSocketMap.get(uid);
  if (!sockets || sockets.size === 0) return null;
  return Array.from(sockets)[0];
};

/**
 * Gets all active socket IDs for a given user.
 * @param {string} userId - User ID
 * @returns {string[]} Array of socket IDs
 */
const getAllUserSocketIds = (userId) => {
  const uid = userId.toString();
  const sockets = userSocketMap.get(uid);
  return sockets ? Array.from(sockets) : [];
};

/**
 * Returns a Set of all currently online user IDs.
 * @returns {Set<string>} Set of online user IDs
 */
const getOnlineUsers = () => {
  return new Set(userSocketMap.keys());
};

/**
 * Checks if a user is currently online.
 * @param {string} userId - User ID
 * @returns {boolean}
 */
const isUserOnline = (userId) => {
  return userSocketMap.has(userId.toString());
};

/**
 * Emits an event to all connected sockets of a specific user.
 * Uses both user room ('user:<id>') and direct socket emit for reliability.
 * @param {string} userId - Recipient User ID
 * @param {string} event - Event name
 * @param {*} data - Payload
 */
const emitToUser = (userId, event, data) => {
  if (!ioInstance) return;
  const uid = userId.toString();
  ioInstance.to(`user:${uid}`).emit(event, data);
};

const emitToConversationParticipants = (conversation, event, data) => {
  if (!ioInstance || !conversation) return;
  const targets = (conversation.participants || []).map((participant) =>
    `user:${participant._id ? participant._id.toString() : participant.toString()}`
  );
  if (!targets.length) return;
  let emitter = ioInstance.to(targets[0]);
  for (const room of targets.slice(1)) emitter = emitter.to(room);
  emitter.emit(event, data);
};

module.exports = {
  setIO,
  getIO,
  setUserSocketId,
  removeUserSocketId,
  getUserSocketId,
  getAllUserSocketIds,
  getOnlineUsers,
  isUserOnline,
  emitToUser,
  emitToConversationParticipants,
};
