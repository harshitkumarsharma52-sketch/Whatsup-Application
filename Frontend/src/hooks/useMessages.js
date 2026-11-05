import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';

const idOf = (x) => (x && typeof x === 'object' ? x._id || x.id : x);

const getMessageType = (mime) => {
  if (!mime) return 'text';
  const main = mime.split('/')[0];
  return ['image', 'video', 'audio'].includes(main) ? main : 'document';
};

// Backend shape -> UI shape (taaki components na badalne padein)
const normalizeMessage = (m) => {
  if (!m) return m;
  const media = m.media || {};
  return {
    ...m,
    isEdited: m.isEdited ?? !!m.editedAt,
    conversationId: m.conversationId || idOf(m.conversation),
    content: m.isDeleted ? 'This message was deleted' : m.text ?? m.content ?? '',
    mediaUrl: media.url || m.mediaUrl || null,
    mediaType: media.mimeType || m.mediaType || m.messageType || null,
    mediaName: media.fileName || m.mediaName || null,
    mediaSize: media.fileSize ?? m.mediaSize ?? null,
    clientTempId: m.idempotencyKey || m.clientTempId,
  };
};

export const useMessages = (conversationId) => {
  const { user } = useAuth();
  const { subscribe } = useSocket();
  const myId = idOf(user);

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [sending, setSending] = useState(false);

  const activeConvIdRef = useRef(conversationId);
  activeConvIdRef.current = conversationId;
  const fetchGenerationRef = useRef(0);

  const markRead = useCallback((messageId) => {
    if (!messageId) return;
    api.post(`/messages/${messageId}/read`).catch(() => {});
  }, []);

  const fetchInitialMessages = useCallback(
    async (convId) => {
      const requestGeneration = ++fetchGenerationRef.current;
      if (!convId) {
        setMessages([]);
        setHasMore(false);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setMessages([]);
        setHasMore(true);
        const res = await api.get(`/messages/${convId}`, { params: { limit: 40 } });
        if (requestGeneration !== fetchGenerationRef.current) return;
        const list = (res.data?.messages || []).map(normalizeMessage);

        setMessages(list); // backend already chronological bhej raha hai
        setHasMore(!!res.data?.hasMore);

        // Last message jo doosre ka hai, usse read mark kar
        const lastIncoming = [...list].reverse().find((m) => idOf(m.sender) !== myId);
        if (lastIncoming) markRead(lastIncoming._id);
      } catch (err) {
        if (requestGeneration !== fetchGenerationRef.current) return;
        console.error('Failed to load messages:', err);
        setMessages([]);
      } finally {
        if (requestGeneration === fetchGenerationRef.current) setLoading(false);
      }
    },
    [myId, markRead]
  );

  useEffect(() => {
    fetchInitialMessages(conversationId);
  }, [conversationId, fetchInitialMessages]);

  const loadMore = useCallback(async () => {
    if (!conversationId || loading || !hasMore || messages.length === 0) return;
    try {
      setLoading(true);
      const res = await api.get(`/messages/${conversationId}`, {
        params: { limit: 30, cursor: messages[0].createdAt }, // backend cursor = createdAt
      });
      const older = (res.data?.messages || []).map(normalizeMessage);

      setMessages((prev) => {
        const ids = new Set(prev.map((m) => m._id));
        return [...older.filter((m) => !ids.has(m._id)), ...prev];
      });
      setHasMore(!!res.data?.hasMore);
    } catch (err) {
      console.error('Failed to load older messages:', err);
    } finally {
      setLoading(false);
    }
  }, [conversationId, loading, hasMore, messages]);

  // Socket listeners (event names backend ke hisaab se)
  useEffect(() => {
    if (!conversationId) return;
    const unReconnect = subscribe('connect', () => fetchInitialMessages(activeConvIdRef.current));

    const unNew = subscribe('newMessage', (raw) => {
      const newMsg = normalizeMessage(raw);
      if (String(newMsg.conversationId) !== String(activeConvIdRef.current)) return;

      setMessages((prev) => {
        const idx = prev.findIndex(
          (m) =>
            m._id === newMsg._id ||
            (m.clientTempId && m.clientTempId === newMsg.clientTempId)
        );
        if (idx > -1) {
          const copy = [...prev];
          copy[idx] = newMsg;
          return copy;
        }
        return [...prev, newMsg];
      });

      if (idOf(newMsg.sender) !== myId) markRead(newMsg._id);
    });

    const unDelivered = subscribe('message:delivered', ({ messageId, conversationId: cId }) => {
      if (String(cId) !== String(activeConvIdRef.current)) return;
      setMessages((prev) => prev.map((m) =>
        m._id === messageId && m.status !== 'read' ? { ...m, status: 'delivered' } : m
      ));
    });

    const unRead = subscribe('message:read', ({ conversationId: cId, userId, lastReadMessageId, readAt }) => {
      if (String(cId) !== String(activeConvIdRef.current)) return;
      if (String(userId) === String(myId)) return; // maine khud padha, ignore
      setMessages((prev) => {
        const target = prev.find((m) => m._id === lastReadMessageId);
        const limit = target ? new Date(target.createdAt).getTime() : new Date(readAt || Date.now()).getTime();
        return prev.map((m) =>
          idOf(m.sender) === myId && new Date(m.createdAt).getTime() <= limit
            ? { ...m, status: 'read' }
            : m
        );
      });
    });

    const unDeleted = subscribe('message:deleted', ({ messageId, deletedForUser }) => {
      setMessages((prev) =>
        deletedForUser
          ? prev.filter((m) => m._id !== messageId)
          : prev.map((m) =>
              m._id === messageId
                ? { ...m, isDeleted: true, content: 'This message was deleted', mediaUrl: null }
                : m
            )
      );
    });

    const unEdited = subscribe('message:edited', (raw) => {
      const updated = normalizeMessage(raw);
      setMessages((prev) => prev.map((m) => (m._id === updated._id ? updated : m)));
    });

    const unReaction = subscribe('message:reaction', ({ messageId, reactions }) => {
      setMessages((prev) => prev.map((m) => (m._id === messageId ? { ...m, reactions } : m)));
    });

    return () => {
      unReconnect();
      unNew();
      unDelivered();
      unRead();
      unDeleted();
      unEdited();
      unReaction();
    };
  }, [conversationId, subscribe, myId, markRead, fetchInitialMessages]);

  const sendMessage = useCallback(
    async ({
      content,
      mediaUrl = null,
      mediaType = null,
      mediaSize = null,
      mediaName = null,
      media = null,
      replyTo = null,
    }) => {
      if (!conversationId) return null;

      const clientTempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      setMessages((prev) => [
        ...prev,
        {
          _id: clientTempId,
          clientTempId,
          conversationId,
          sender: user,
          content,
          mediaUrl: media?.url || mediaUrl,
          mediaType: media?.mimeType || mediaType,
          mediaSize: media?.fileSize || mediaSize,
          mediaName: media?.fileName || mediaName,
          media: media || undefined,
          replyTo,
          status: 'sending',
          createdAt: new Date().toISOString(),
        },
      ]);
      setSending(true);

      try {
        const finalMediaUrl = media?.url || mediaUrl;
        const finalMediaType = media?.mimeType || mediaType;

        const payload = {
          conversationId,
          text: content || '',
          messageType: finalMediaUrl ? getMessageType(finalMediaType) : 'text',
          media: media || (finalMediaUrl
            ? {
                url: finalMediaUrl,
                fileName: mediaName || media?.fileName,
                fileSize: mediaSize || media?.fileSize,
                mimeType: finalMediaType,
              }
            : undefined),
          replyTo: idOf(replyTo) || undefined,
          idempotencyKey: clientTempId,
        };

        const res = await api.post('/messages', payload);
        const serverMsg = normalizeMessage(res.data?.message);

        setMessages((prev) => {
          // Socket se message pehle aa chuka ho to duplicate na bane
          const alreadyThere = prev.some((m) => m._id === serverMsg._id);
          if (alreadyThere) return prev.filter((m) => m._id !== clientTempId);
          return prev.map((m) =>
            m.clientTempId === clientTempId
              ? { ...serverMsg, status: serverMsg.status || 'sent' }
              : m
          );
        });

        return serverMsg;
      } catch (err) {
        console.error('Failed to send message:', err.response?.data || err);
        setMessages((prev) =>
          prev.map((m) => (m.clientTempId === clientTempId ? { ...m, status: 'failed' } : m))
        );
        throw err;
      } finally {
        setSending(false);
      }
    },
    [conversationId, user]
  );

  const retryMessage = useCallback((message) => {
    setMessages((prev) => prev.filter((item) => item._id !== message._id));
    return sendMessage({
      content: message.content,
      mediaUrl: message.mediaUrl,
      mediaType: message.mediaType,
      mediaSize: message.mediaSize,
      mediaName: message.mediaName,
      media: message.media,
      replyTo: message.replyTo,
    });
  }, [sendMessage]);

  const deleteMessage = useCallback(async (messageId, deleteForEveryone = false) => {
    try {
      await api.delete(`/messages/${messageId}`, { data: { deleteForEveryone } });
      setMessages((prev) =>
        deleteForEveryone
          ? prev.map((m) =>
              m._id === messageId
                ? { ...m, isDeleted: true, content: 'This message was deleted', mediaUrl: null }
                : m
            )
          : prev.filter((m) => m._id !== messageId)
      );
    } catch (err) {
      console.error('Failed to delete message:', err);
      throw err;
    }
  }, []);

  const editMessage = useCallback(async (messageId, newContent) => {
    try {
      const res = await api.put(`/messages/${messageId}`, { text: newContent });
      const updated = normalizeMessage(res.data?.message);
      setMessages((prev) => prev.map((m) => (m._id === messageId ? updated : m)));
    } catch (err) {
      console.error('Failed to edit message:', err);
      throw err;
    }
  }, []);

  const reactToMessage = useCallback(async (messageId, reactionEmoji) => {
    try {
      const res = await api.post(`/messages/${messageId}/reactions`, { emoji: reactionEmoji });
      setMessages((prev) =>
        prev.map((m) => (m._id === messageId ? { ...m, reactions: res.data?.reactions } : m))
      );
    } catch (err) {
      console.error('Failed to react to message:', err);
    }
  }, []);

  const clearMessages = useCallback(() => setMessages([]), []);

  return {
    messages,
    loading,
    hasMore,
    sending,
    loadMore,
    sendMessage,
    retryMessage,
    deleteMessage,
    editMessage,
    reactToMessage,
    clearMessages,
  };
};

export default useMessages;
