import React from 'react';
import { Image, Video, Music, FileText, Ban } from 'lucide-react';
import Avatar from '../common/Avatar';
import { formatRelativeTime, truncateText } from '../../utils/formatters';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';

export const ConversationItem = ({
  conversation,
  isSelected = false,
  onClick,
}) => {
  const { user } = useAuth();
  const { isUserOnline, typingUsers } = useSocket();

  const isGroup = conversation.isGroup || conversation.type === 'group';

  // Find other participant for direct chat
  const otherParticipant = isGroup
    ? null
    : conversation.participants?.find(
        (p) => (p._id || p.id) !== (user?._id || user?.id)
      ) || conversation.recipient;

  const title = isGroup
    ? conversation.name || 'Group Chat'
    : otherParticipant?.username ||
      otherParticipant?.name ||
      'Chat';

  const avatarSrc = isGroup
    ? conversation.groupImage || conversation.avatar
    : otherParticipant?.avatar;

  const isOnline = otherParticipant
    ? isUserOnline(otherParticipant._id || otherParticipant.id)
    : false;

  const convId = conversation._id || conversation.id;
  const isTyping =
    convId &&
    typingUsers.has(convId) &&
    typingUsers.get(convId).size > 0;

  const lastMsg = conversation.lastMessage;
  const unreadCount = conversation.unreadCount || 0;

  const renderLastMessage = () => {
    if (isTyping) {
      return (
        <span className="text-primary-600 dark:text-primary-400 font-medium animate-pulse">
          typing...
        </span>
      );
    }

    if (!lastMsg) {
      return <span className="text-gray-400 italic">No messages yet</span>;
    }

    if (lastMsg.isDeleted) {
      return (
        <span className="flex items-center text-gray-400 italic">
          <Ban className="w-3 h-3 mr-1 inline" />
          This message was deleted
        </span>
      );
    }

    const isOwn =
      (lastMsg.sender?._id || lastMsg.sender) === (user?._id || user?.id);
    const prefix = isOwn ? 'You: ' : '';

    if (lastMsg.mediaType?.startsWith('image/')) {
      return (
        <span className="flex items-center">
          <Image className="w-3.5 h-3.5 mr-1 text-gray-400" />
          <span>{prefix}Photo</span>
        </span>
      );
    }

    if (lastMsg.mediaType?.startsWith('video/')) {
      return (
        <span className="flex items-center">
          <Video className="w-3.5 h-3.5 mr-1 text-gray-400" />
          <span>{prefix}Video</span>
        </span>
      );
    }

    if (lastMsg.mediaType?.startsWith('audio/')) {
      return (
        <span className="flex items-center">
          <Music className="w-3.5 h-3.5 mr-1 text-gray-400" />
          <span>{prefix}Audio message</span>
        </span>
      );
    }

    if (lastMsg.mediaUrl) {
      return (
        <span className="flex items-center">
          <FileText className="w-3.5 h-3.5 mr-1 text-gray-400" />
          <span>{prefix}{lastMsg.mediaName || 'Document'}</span>
        </span>
      );
    }

    return <span>{prefix}{truncateText(lastMsg.content, 35)}</span>;
  };

  const timestamp = lastMsg?.createdAt || conversation.updatedAt;

  return (
    <div
      onClick={onClick}
      className={`flex items-center px-4 py-3 cursor-pointer transition-colors border-b border-gray-100 dark:border-gray-800/40 select-none ${
        isSelected
          ? 'bg-gray-100 dark:bg-dark-input'
          : 'hover:bg-gray-50 dark:hover:bg-dark-input/50'
      }`}
    >
      {/* Avatar with status indicator */}
      <Avatar
        src={avatarSrc}
        name={title}
        isGroup={isGroup}
        isOnline={isOnline}
        showOnlineDot={!isGroup}
        size="md"
        className="mr-3"
      />

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline mb-1">
          <h3
            className={`text-sm font-semibold truncate ${
              unreadCount > 0
                ? 'text-gray-900 dark:text-white font-bold'
                : 'text-gray-800 dark:text-gray-200'
            }`}
          >
            {title}
          </h3>
          {timestamp && (
            <span
              className={`text-[11px] flex-shrink-0 ml-2 ${
                unreadCount > 0
                  ? 'text-primary-600 dark:text-primary-400 font-semibold'
                  : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              {formatRelativeTime(timestamp)}
            </span>
          )}
        </div>

        <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
          <div className="truncate pr-2">{renderLastMessage()}</div>

          {unreadCount > 0 && (
            <span className="flex-shrink-0 min-w-4 h-4 px-1.5 flex items-center justify-center bg-primary-500 text-white font-bold text-[10px] rounded-full shadow-xs">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConversationItem;
