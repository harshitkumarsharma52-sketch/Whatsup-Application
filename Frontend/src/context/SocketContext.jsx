import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { initSocket, disconnectSocket } from '../services/socket';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user, isAuthenticated, accessToken, refreshAuth } = useAuth();
  const userId = user?._id || user?.id;
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  // Map conversationId -> Set of userIds
  const [typingUsers, setTypingUsers] = useState(new Map());
  const typingTimeoutsRef = useRef(new Map());
  const refreshingSocketAuthRef = useRef(false);

  // Use refs to store event listeners for broadcast
  const listenersRef = useRef({
    newMessage: new Set(),
    'message:delivered': new Set(),
    'message:read': new Set(),
    'message:deleted': new Set(),
    'message:edited': new Set(),
    'message:reaction': new Set(),
    'conversation:new': new Set(),
    'conversation:unread': new Set(),
    'connect': new Set(),
  });

  // Helper to subscribe to socket events from hooks
  const subscribe = useCallback((event, callback) => {
    if (listenersRef.current[event]) {
      listenersRef.current[event].add(callback);
      return () => {
        listenersRef.current[event].delete(callback);
      };
    }
    return () => {};
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      disconnectSocket();
      setSocket(null);
      setOnlineUsers(new Set());
      setTypingUsers(new Map());
      typingTimeoutsRef.current.forEach(clearTimeout);
      typingTimeoutsRef.current.clear();
      return;
    }

    const currentSocket = initSocket(accessToken);
    setSocket(currentSocket);

    // Initial online list or connected users list
    const handleInitialOnlineUsers = (usersList) => {
      if (Array.isArray(usersList)) {
        setOnlineUsers(new Set(usersList.map((u) => (typeof u === 'object' ? u._id || u.id : u))));
      }
    };

    const handleUserOnline = (data) => {
      const userId = typeof data === 'object' ? data.userId || data._id || data.id : data;
      if (userId) {
        setOnlineUsers((prev) => new Set([...prev, userId]));
      }
    };

    const handleUserOffline = (data) => {
      const userId = typeof data === 'object' ? data.userId || data._id || data.id : data;
      if (userId) {
        setOnlineUsers((prev) => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        });
      }
    };

    const handleTypingStart = ({ conversationId, userId, username }) => {
      if (!conversationId || !userId || String(userId) === String(userIdRef.current)) return;
      setTypingUsers((prev) => {
        const next = new Map(prev);
        const set = new Set(next.get(conversationId) || []);
        set.add(userId);
        next.set(conversationId, set);
        return next;
      });
      const key = `${conversationId}:${userId}`;
      clearTimeout(typingTimeoutsRef.current.get(key));
      typingTimeoutsRef.current.set(key, setTimeout(() => {
        setTypingUsers((prev) => {
          const next = new Map(prev);
          const users = new Set(next.get(conversationId) || []);
          users.delete(userId);
          if (users.size) next.set(conversationId, users);
          else next.delete(conversationId);
          return next;
        });
        typingTimeoutsRef.current.delete(key);
      }, 5000));
    };

    const handleTypingStop = ({ conversationId, userId }) => {
      if (!conversationId || !userId) return;
      const key = `${conversationId}:${userId}`;
      clearTimeout(typingTimeoutsRef.current.get(key));
      typingTimeoutsRef.current.delete(key);
      setTypingUsers((prev) => {
        const next = new Map(prev);
        const set = new Set(next.get(conversationId) || []);
        set.delete(userId);
        if (set.size === 0) {
          next.delete(conversationId);
        } else {
          next.set(conversationId, set);
        }
        return next;
      });
    };

    // Forward messages to registered subscribers
    const handleNewMessage = (message) => {
      listenersRef.current.newMessage.forEach((cb) => cb(message));
    };

    const handleDelivered = (data) => {
      listenersRef.current['message:delivered'].forEach((cb) => cb(data));
    };

    const handleRead = (data) => {
      listenersRef.current['message:read'].forEach((cb) => cb(data));
    };

    const handleDeleted = (data) => {
      listenersRef.current['message:deleted'].forEach((cb) => cb(data));
    };

    const handleEdited = (data) => {
      listenersRef.current['message:edited'].forEach((cb) => cb(data));
    };

    const forward = (event) => (data) => listenersRef.current[event]?.forEach((cb) => cb(data));
    const handleConversationNew = (conversation) => {
      const conversationId = conversation?._id || conversation?.id;
      if (conversationId) currentSocket.emit('group:join', { conversationId });
      forward('conversation:new')(conversation);
    };
    const handleConnect = () => listenersRef.current.connect.forEach((cb) => cb());
    const handleConnectError = async (error) => {
      if (refreshingSocketAuthRef.current || !/auth|token|expired/i.test(error.message || '')) return;
      refreshingSocketAuthRef.current = true;
      try {
        const freshToken = await refreshAuth();
        if (freshToken) {
          currentSocket.auth = { token: freshToken };
          currentSocket.disconnect();
          currentSocket.connect();
        }
      } catch {
        // AuthContext clears the session and disconnects this socket when refresh fails.
      } finally {
        refreshingSocketAuthRef.current = false;
      }
    };

    currentSocket.on('users:online', handleInitialOnlineUsers);
    currentSocket.on('online:users', handleInitialOnlineUsers);
    currentSocket.on('user:online', handleUserOnline);
    currentSocket.on('user:offline', handleUserOffline);
    currentSocket.on('typing:start', handleTypingStart);
    currentSocket.on('typing:stop', handleTypingStop);

    currentSocket.on('newMessage', handleNewMessage);
    currentSocket.on('message:delivered', handleDelivered);
    currentSocket.on('message:read', handleRead);
    currentSocket.on('message:deleted', handleDeleted);
    currentSocket.on('message:edited', handleEdited);
    currentSocket.on('message:reaction', forward('message:reaction'));
    currentSocket.on('conversation:new', handleConversationNew);
    currentSocket.on('group:created', handleConversationNew);
    currentSocket.on('group:invited', handleConversationNew);
    currentSocket.on('conversation:unread', forward('conversation:unread'));
    currentSocket.on('connect', handleConnect);
    currentSocket.on('connect_error', handleConnectError);
    currentSocket.connect();

    return () => {
      currentSocket.off('users:online', handleInitialOnlineUsers);
      currentSocket.off('online:users', handleInitialOnlineUsers);
      currentSocket.off('user:online', handleUserOnline);
      currentSocket.off('user:offline', handleUserOffline);
      currentSocket.off('typing:start', handleTypingStart);
      currentSocket.off('typing:stop', handleTypingStop);
      currentSocket.off('newMessage', handleNewMessage);
      currentSocket.off('message:delivered', handleDelivered);
      currentSocket.off('message:read', handleRead);
      currentSocket.off('message:deleted', handleDeleted);
      currentSocket.off('message:edited', handleEdited);
      currentSocket.off('message:reaction');
      currentSocket.off('conversation:new', handleConversationNew);
      currentSocket.off('group:created', handleConversationNew);
      currentSocket.off('group:invited', handleConversationNew);
      currentSocket.off('conversation:unread');
      currentSocket.off('connect', handleConnect);
      currentSocket.off('connect_error', handleConnectError);
    };
  }, [isAuthenticated, userId, accessToken, refreshAuth]);

  const isUserOnline = useCallback(
    (userId) => {
      if (!userId) return false;
      return onlineUsers.has(userId);
    },
    [onlineUsers]
  );

  const emitTypingStart = useCallback(
    (conversationId) => {
      if (socket && conversationId) {
        socket.emit('typing:start', { conversationId });
      }
    },
    [socket]
  );

  const emitTypingStop = useCallback(
    (conversationId) => {
      if (socket && conversationId) {
        socket.emit('typing:stop', { conversationId });
      }
    },
    [socket]
  );

  const sendMessage = useCallback(
    (messageData) => {
      if (socket) {
        socket.emit('message:send', messageData);
      }
    },
    [socket]
  );

  const sendRead = useCallback(
    (messageId, conversationId) => {
      if (socket && conversationId) {
        socket.emit('message:read', { messageId, conversationId });
      }
    },
    [socket]
  );

  const value = {
    socket,
    onlineUsers,
    typingUsers,
    isUserOnline,
    emitTypingStart,
    emitTypingStop,
    sendMessage,
    sendRead,
    subscribe,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export default SocketContext;
