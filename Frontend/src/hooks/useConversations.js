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

      const currentUserId = user?._id || user?.id;
      setConversations(sorted.map((conversation) => ({
        ...conversation,
        unreadCount: conversation.unreadCounts?.[currentUserId] ?? conversation.unreadCount ?? 0,
      })));
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
      setError(err.response?.data?.message || 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Subscribe to real-time socket events
  useEffect(() => {
    const upsertConversation = (conversation) => {
      if (!conversation?._id && !conversation?.id) return;
      const id = String(conversation._id || conversation.id);
      setConversations((prev) => [
        { ...conversation, unreadCount: conversation.unreadCounts?.[user?._id || user?.id] ?? 0 },
        ...prev.filter((item) => String(item._id || item.id) !== id),
      ]);
    };

    const unsubscribeConversation = subscribe('conversation:new', upsertConversation);
    const unsubscribeUnread = subscribe('conversation:unread', ({ conversationId, unreadCount }) => {
      setConversations((prev) => prev.map((conversation) =>
        String(conversation._id || conversation.id) === String(conversationId)
          ? { ...conversation, unreadCount }
          : conversation
      ));
    });

    const unsubscribeNew = subscribe('newMessage', (newMsg) => {
      const convId =
        newMsg.conversationId ||
        (typeof newMsg.conversation === 'object'
          ? newMsg.conversation?._id
          : newMsg.conversation);

      if (!convId) return;

      const current = conversations.find((c) => String(c._id || c.id) === String(convId));
      if (!current) {
        fetchConversations();
        return;
      }
      const isCurrentActive = String(activeConversationId || '') === String(convId);
      const isSentByMe = String(newMsg.sender?._id || newMsg.sender) === String(user?._id || user?.id);
      setConversations((prevList) => [
        {
          ...current,
          lastMessage: newMsg,
          updatedAt: newMsg.createdAt || new Date().toISOString(),
          unreadCount: isCurrentActive || isSentByMe ? 0 : (current.unreadCount || 0) + 1,
        },
        ...prevList.filter((c) => String(c._id || c.id) !== String(convId)),
      ]);
    });

    const unsubscribeDelete = subscribe('message:deleted', ({ messageId, conversationId }) => {
      setConversations((prevList) =>
        prevList.map((c) => {
          if (String(c._id || c.id) === String(conversationId) && String(c.lastMessage?._id) === String(messageId)) {
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

    const unsubscribeEdit = subscribe('message:edited', (editedMsg) => {
      const convId =
        editedMsg.conversationId ||
        (typeof editedMsg.conversation === 'object'
          ? editedMsg.conversation?._id
          : editedMsg.conversation);

      setConversations((prevList) =>
        prevList.map((c) => {
          if (String(c._id || c.id) === String(convId) && String(c.lastMessage?._id) === String(editedMsg._id)) {
            return {
              ...c,
              lastMessage: editedMsg,
            };
          }
          return c;
        })
      );
    });
    const unsubscribeAvatar = subscribe('user:avatar', ({ userId, avatar }) => {
      setConversations((prev) => prev.map((conversation) => ({
        ...conversation,
        participants: conversation.participants?.map((participant) =>
          String(participant._id || participant.id) === String(userId)
            ? { ...participant, avatar }
            : participant
        ),
      })));
    });

    return () => {
      unsubscribeConversation();
      unsubscribeUnread();
      unsubscribeNew();
      unsubscribeDelete();
      unsubscribeEdit();
      unsubscribeAvatar();
    };
  }, [subscribe, activeConversationId, user, fetchConversations, conversations]);

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
