import React, { useEffect, useRef, useState } from 'react';
import MessageBubble from './MessageBubble';
import { formatDate } from '../../utils/formatters';
import { MessageBubbleSkeleton } from '../common/LoadingSkeleton';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { ChevronDown, ArrowUp } from 'lucide-react';

export const MessageList = ({
  messages = [],
  loading = false,
  hasMore = false,
  onLoadMore,
  onReply,
  onDelete,
  onEdit,
  onReact,
  onRetry,
  onMediaClick,
  conversationId,
}) => {
  const { user } = useAuth();
  const { typingUsers } = useSocket();
  const scrollContainerRef = useRef(null);
  const bottomRef = useRef(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const prevMessagesLengthRef = useRef(messages.length);
  const pendingPrependRef = useRef(null);
  const firstMessageIdRef = useRef(messages[0]?._id);

  // Check if someone else is typing in this conversation
  const isTyping =
    conversationId &&
    typingUsers.has(conversationId) &&
    typingUsers.get(conversationId).size > 0;

  // Auto-scroll on initial load or new messages
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (pendingPrependRef.current && container && messages[0]?._id !== firstMessageIdRef.current) {
      const { height, top } = pendingPrependRef.current;
      container.scrollTop = top + (container.scrollHeight - height);
      pendingPrependRef.current = null;
      firstMessageIdRef.current = messages[0]?._id;
      prevMessagesLengthRef.current = messages.length;
      return;
    }
    if (messages.length > 0 && prevMessagesLengthRef.current === 0) {
      // First load: scroll to bottom immediately
      bottomRef.current?.scrollIntoView({ behavior: 'auto' });
    } else if (messages.length > prevMessagesLengthRef.current) {
      // New message appended: smooth scroll to bottom if already near bottom
      const container = scrollContainerRef.current;
      if (container) {
        const isNearBottom =
          container.scrollHeight - container.scrollTop - container.clientHeight < 250;
        if (isNearBottom) {
          bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
      }
    }
    prevMessagesLengthRef.current = messages.length;
    firstMessageIdRef.current = messages[0]?._id;
  }, [messages]);

  const loadOlder = () => {
    const container = scrollContainerRef.current;
    if (container && !loading) {
      pendingPrependRef.current = { height: container.scrollHeight, top: container.scrollTop };
    }
    onLoadMore?.();
  };

  // Handle scroll events (show/hide scroll-to-bottom button & detect scroll-to-top)
  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 200;
    setShowScrollBottom(!isNearBottom);

    // If scrolled to top and hasMore, trigger loadMore
    if (container.scrollTop === 0 && hasMore && !loading) {
      loadOlder();
    }
  };

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="relative flex-1 min-h-0 bg-chat-bg dark:bg-dark-bg overflow-hidden flex flex-col">
      {/* Scrollable messages container */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 space-y-1"
      >
        {/* Load More Button / Indicator */}
        {hasMore && (
          <div className="flex justify-center my-2">
            <button
              onClick={loadOlder}
              disabled={loading}
              className="px-3 py-1 bg-white dark:bg-dark-header border border-gray-200 dark:border-gray-700/60 text-xs text-gray-600 dark:text-gray-300 rounded-full shadow-xs hover:bg-gray-50 dark:hover:bg-dark-input transition-colors disabled:opacity-50 inline-flex items-center space-x-1"
            >
              <ArrowUp className="w-3 h-3" />
              <span>{loading ? 'Loading older messages...' : 'Load older messages'}</span>
            </button>
          </div>
        )}

        {/* Initial Loading Skeleton */}
        {loading && messages.length === 0 && (
          <div className="space-y-4 py-4">
            <MessageBubbleSkeleton incoming={true} />
            <MessageBubbleSkeleton incoming={false} />
            <MessageBubbleSkeleton incoming={true} />
            <MessageBubbleSkeleton incoming={false} />
            <MessageBubbleSkeleton incoming={true} />
          </div>
        )}

        {/* Empty state for empty conversation */}
        {!loading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 text-gray-500 dark:text-gray-400">
            <div className="w-16 h-16 rounded-full bg-primary-50 dark:bg-dark-input flex items-center justify-center text-primary-500 mb-3">
              👋
            </div>
            <p className="text-sm font-medium">No messages yet</p>
            <p className="text-xs mt-1">Say hello to start the conversation!</p>
          </div>
        )}

        {/* Message List with Date Separators */}
        {messages.map((message, index) => {
          const currentMsgDate = formatDate(message.createdAt);
          const prevMsg = messages[index - 1];
          const prevMsgDate = prevMsg ? formatDate(prevMsg.createdAt) : null;
          const showDateSeparator = currentMsgDate !== prevMsgDate;

          const senderId =
            typeof message.sender === 'object'
              ? message.sender?._id || message.sender?.id
              : message.sender;
          const currentUserId = user?._id || user?.id;
          const isOwn = senderId === currentUserId;
          const prevSenderId = prevMsg && (typeof prevMsg.sender === 'object'
            ? prevMsg.sender?._id || prevMsg.sender?.id
            : prevMsg.sender);
          const sameSender = prevSenderId && String(prevSenderId) === String(senderId)
            && prevMsgDate === currentMsgDate;

          return (
            <React.Fragment key={message._id || message.id || message.clientTempId}>
              {showDateSeparator && (
                <div className="flex justify-center my-3 select-none">
                  <span className="px-3 py-1 bg-white/90 dark:bg-dark-header/90 text-gray-600 dark:text-gray-300 text-[11px] font-medium rounded-full shadow-xs border border-gray-100 dark:border-gray-800">
                    {currentMsgDate}
                  </span>
                </div>
              )}

              <MessageBubble
                message={message}
                isOwn={isOwn}
                showAvatar={!isOwn && !sameSender}
                onReply={onReply}
                onDelete={onDelete}
                onEdit={onEdit}
                onReact={onReact}
                onRetry={onRetry}
                onMediaClick={onMediaClick}
              />
            </React.Fragment>
          );
        })}

        {/* Typing indicator bubble */}
        {isTyping && (
          <div className="flex items-center space-x-2 my-1 px-2 animate-fade-in">
            <div className="bubble-incoming px-4 py-2.5 rounded-2xl rounded-tl-xs flex items-center space-x-1 shadow-xs">
              <span className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full typing-dot-1" />
              <span className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full typing-dot-2" />
              <span className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full typing-dot-3" />
            </div>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={bottomRef} className="h-2" />
      </div>

      {/* Floating Scroll to Bottom Button */}
      {showScrollBottom && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 right-4 p-2.5 rounded-full bg-white dark:bg-dark-header text-gray-700 dark:text-gray-200 shadow-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-dark-input transition-all animate-bounce-short z-20"
          title="Scroll to bottom"
        >
          <ChevronDown className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};

export default MessageList;
