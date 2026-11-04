import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { initSocket, disconnectSocket } from '../services/socket';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user, isAuthenticated, accessToken } = useAuth();
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  // Map conversationId -> Set of userIds
  const [typingUsers, setTypingUsers] = useState(new Map());

  // Use refs to store event listeners for broadcast
  const listenersRef = useRef({
    'message:new': new Set(),
    'message:delivered': new Set(),
    'message:read': new Set(),
    'message:delete': new Set(),
    'message:edit': new Set(),
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
      if (!conversationId || !userId || userId === (user._id || user.id)) return;
      setTypingUsers((prev) => {
        const next = new Map(prev);
        const set = new Set(next.get(conversationId) || []);
        set.add(userId);
        next.set(conversationId, set);
        return next;
      });
    };

    const handleTypingStop = ({ conversationId, userId }) => {
      if (!conversationId || !userId) return;
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
      listenersRef.current['message:new'].forEach((cb) => cb(message));
    };

    const handleDelivered = (data) => {
      listenersRef.current['message:delivered'].forEach((cb) => cb(data));
    };

    const handleRead = (data) => {
      listenersRef.current['message:read'].forEach((cb) => cb(data));
    };

    const handleDelete = (data) => {
      listenersRef.current['message:delete'].forEach((cb) => cb(data));
    };

    const handleEdit = (data) => {
      listenersRef.current['message:edit'].forEach((cb) => cb(data));
    };

    currentSocket.on('users:online', handleInitialOnlineUsers);
    currentSocket.on('online:users', handleInitialOnlineUsers);
    currentSocket.on('user:online', handleUserOnline);
    currentSocket.on('user:offline', handleUserOffline);
    currentSocket.on('typing:start', handleTypingStart);
    currentSocket.on('typing:stop', handleTypingStop);

    currentSocket.on('message:new', handleNewMessage);
    currentSocket.on('message:delivered', handleDelivered);
    currentSocket.on('message:read', handleRead);
    currentSocket.on('message:delete', handleDelete);
    currentSocket.on('message:edit', handleEdit);

    return () => {
      currentSocket.off('users:online', handleInitialOnlineUsers);
      currentSocket.off('online:users', handleInitialOnlineUsers);
      currentSocket.off('user:online', handleUserOnline);
      currentSocket.off('user:offline', handleUserOffline);
      currentSocket.off('typing:start', handleTypingStart);
      currentSocket.off('typing:stop', handleTypingStop);
      currentSocket.off('message:new', handleNewMessage);
      currentSocket.off('message:delivered', handleDelivered);
      currentSocket.off('message:read', handleRead);
      currentSocket.off('message:delete', handleDelete);
      currentSocket.off('message:edit', handleEdit);
    };
  }, [isAuthenticated, user, accessToken]);

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
