import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';

export const useConversations = (activeConversationId = null) => {
  const { user } = useAuth();
  const { subscribe } = useSocket();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchConversations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/conversations');
      const list = Array.isArray(res.data)
        ? res.data
        : res.data?.conversations || res.data?.data || [];

      // Sort by latest message or updatedAt
      const sorted = [...list].sort((a, b) => {
        const timeA = new Date(a.lastMessage?.createdAt || a.updatedAt || 0).getTime();
        const timeB = new Date(b.lastMessage?.createdAt || b.updatedAt || 0).getTime();
        return timeB - timeA;
      });

      setConversations(sorted);
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
      setError(err.response?.data?.message || 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Subscribe to real-time socket events
  useEffect(() => {
    const unsubscribeNew = subscribe('message:new', (newMsg) => {
      const convId =
        newMsg.conversationId ||
        (typeof newMsg.conversation === 'object'
          ? newMsg.conversation?._id
          : newMsg.conversation);

      if (!convId) return;

      setConversations((prevList) => {
        const existingIndex = prevList.findIndex(
          (c) => (c._id || c.id) === convId
        );

        if (existingIndex > -1) {
          const currentConv = prevList[existingIndex];
          const isCurrentActive =
            activeConversationId && (activeConversationId === convId);
          const isSentByMe =
            (newMsg.sender?._id || newMsg.sender) === (user?._id || user?.id);

          const updatedConv = {
            ...currentConv,
            lastMessage: newMsg,
            updatedAt: newMsg.createdAt || new Date().toISOString(),
            unreadCount:
              isCurrentActive || isSentByMe
                ? 0
                : (currentConv.unreadCount || 0) + 1,
          };

          const remaining = prevList.filter((_, idx) => idx !== existingIndex);
          return [updatedConv, ...remaining];
        } else {
          // If conversation is brand new to this user, refetch full list
          fetchConversations();
          return prevList;
        }
      });
    });

    const unsubscribeDelete = subscribe('message:delete', ({ messageId, conversationId }) => {
      setConversations((prevList) =>
        prevList.map((c) => {
          if ((c._id || c.id) === conversationId && c.lastMessage?._id === messageId) {
            return {
              ...c,
              lastMessage: {
                ...c.lastMessage,
                isDeleted: true,
                content: 'This message was deleted',
              },
            };
          }
          return c;
        })
      );
    });

    const unsubscribeEdit = subscribe('message:edit', (editedMsg) => {
      const convId =
        editedMsg.conversationId ||
        (typeof editedMsg.conversation === 'object'
          ? editedMsg.conversation?._id
          : editedMsg.conversation);

      setConversations((prevList) =>
        prevList.map((c) => {
          if ((c._id || c.id) === convId && c.lastMessage?._id === editedMsg._id) {
            return {
              ...c,
              lastMessage: editedMsg,
            };
          }
          return c;
        })
      );
    });

    return () => {
      unsubscribeNew();
      unsubscribeDelete();
      unsubscribeEdit();
    };
  }, [subscribe, activeConversationId, user, fetchConversations]);

  const markAsRead = useCallback(async (conversationId) => {
    if (!conversationId) return;
    try {
      setConversations((prevList) =>
        prevList.map((c) =>
          (c._id || c.id) === conversationId ? { ...c, unreadCount: 0 } : c
        )
      );
      await api.post(`/conversations/${conversationId}/read`).catch(() => {});
    } catch (e) {
      // Ignored
    }
  }, []);

  return {
    conversations,
    setConversations,
    loading,
    error,
    refetch: fetchConversations,
    markAsRead,
  };
};

export default useConversations;
