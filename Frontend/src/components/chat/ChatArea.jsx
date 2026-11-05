import React, { useState } from 'react';
import { MessageSquare, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import ChatHeader from './ChatHeader';
import MessageList from '../messages/MessageList';
import MessageInput from '../messages/MessageInput';
import MediaPreview from '../media/MediaPreview';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { useMessages } from '../../hooks/useMessages';
import api from '../../services/api';

export const ChatArea = ({
  conversation,
  onBack,
  onViewProfile,
}) => {
  const convId = conversation?._id || conversation?.id;

  const {
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
  } = useMessages(convId);

  const [replyTo, setReplyTo] = useState(null);
  const [activeMedia, setActiveMedia] = useState(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // If no conversation is selected, display WhatsApp-style placeholder
  if (!conversation) {
    return (
      <div className="hidden md:flex flex-1 flex-col items-center justify-center bg-chat-bg dark:bg-dark-bg p-8 text-center border-l border-gray-200 dark:border-gray-800 select-none">
        <div className="w-20 h-20 rounded-full bg-primary-100 dark:bg-dark-header flex items-center justify-center text-primary-500 mb-6 shadow-inner">
          <MessageSquare className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-light text-gray-800 dark:text-gray-200 tracking-wide">
          ChatApp for Web
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mt-2 leading-relaxed">
          Send and receive messages in real-time. Select a chat from the sidebar to start messaging.
        </p>
        <div className="mt-8 flex items-center space-x-1.5 text-xs text-gray-400 dark:text-gray-500">
          <Lock className="w-3.5 h-3.5" />
          <span>Private conversations for your account</span>
        </div>
      </div>
    );
  }

  const handleSendMessage = async (data) => {
    await sendMessage(data);
    setReplyTo(null);
  };

  const handleConfirmClearChat = async () => {
    try {
      await api.delete(`/conversations/${convId}`);
      clearMessages();
      setShowClearConfirm(false);
      toast.success('Chat cleared');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not clear chat');
    }
  };

  return (
    <div className="panel-enter flex-1 flex flex-col h-full bg-chat-bg dark:bg-dark-bg relative overflow-hidden">
      {/* Header */}
      <ChatHeader
        conversation={conversation}
        onBack={onBack}
        onClearChat={() => setShowClearConfirm(true)}
        onViewProfile={onViewProfile}
      />

      {/* Message List */}
      <MessageList
        conversationId={convId}
        messages={messages}
        loading={loading}
        hasMore={hasMore}
        onLoadMore={loadMore}
        onReply={(msg) => setReplyTo(msg)}
        onDelete={deleteMessage}
        onEdit={editMessage}
        onReact={reactToMessage}
        onRetry={retryMessage}
        onMediaClick={(media) => setActiveMedia(media)}
      />

      {/* Message Input */}
      <MessageInput
        conversationId={convId}
        onSendMessage={handleSendMessage}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        disabled={sending}
      />

      {/* Full-screen Media Lightbox */}
      {activeMedia && (
        <MediaPreview
          src={activeMedia.url}
          type={activeMedia.type}
          name={activeMedia.name}
          onClose={() => setActiveMedia(null)}
        />
      )}

      {/* Clear Chat Confirmation Modal */}
      <Modal
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        title="Clear this chat?"
      >
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Messages will be cleared from this chat. This action cannot be undone.
        </p>
        <div className="flex justify-end space-x-3 mt-6">
          <Button
            variant="ghost"
            onClick={() => setShowClearConfirm(false)}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirmClearChat}
          >
            Clear Messages
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default ChatArea;
