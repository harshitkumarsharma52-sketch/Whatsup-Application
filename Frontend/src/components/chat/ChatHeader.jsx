import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  MoreVertical,
  Phone,
  Video,
  User,
  Trash2,
  ShieldAlert,
  Slash,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Avatar from '../common/Avatar';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { formatRelativeTime } from '../../utils/formatters';

export const ChatHeader = ({
  conversation,
  onBack,
  onClearChat,
  onViewProfile,
}) => {
  const { user } = useAuth();
  const { isUserOnline, typingUsers } = useSocket();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!conversation) return null;

  const isGroup = conversation.isGroup || conversation.type === 'group';

  // Determine other participant for private chats
  const otherParticipant = isGroup
    ? null
    : conversation.participants?.find(
        (p) => (p._id || p.id) !== (user?._id || user?.id)
      ) || conversation.recipient;

  const conversationName = isGroup
    ? conversation.groupName || conversation.name || 'Group Chat'
    : otherParticipant?.username ||
      otherParticipant?.name ||
      'Chat';

  const avatarSrc = isGroup
    ? conversation.groupImage?.url || conversation.groupImage || conversation.avatar
    : otherParticipant?.profilePicture?.url || otherParticipant?.avatar;

  const isOnline = otherParticipant
    ? isUserOnline(otherParticipant._id || otherParticipant.id)
    : false;

  const convId = conversation._id || conversation.id;
  const isTyping =
    convId &&
    typingUsers.has(convId) &&
    typingUsers.get(convId).size > 0;

  const getSubStatus = () => {
    if (isTyping) {
      return (
        <span className="text-primary-600 dark:text-primary-400 font-medium animate-pulse">
          typing...
        </span>
      );
    }
    if (isGroup) {
      const memberCount = conversation.participants?.length || 0;
      return `${memberCount} members`;
    }
    if (isOnline) {
      return <span className="text-primary-600 dark:text-primary-400 font-medium">online</span>;
    }
    if (otherParticipant?.lastSeen) {
      return `last seen ${formatRelativeTime(otherParticipant.lastSeen)}`;
    }
    return 'offline';
  };

  const handleCall = (type) => {
    toast(`Starting ${type} call with ${conversationName}...`, {
      icon: type === 'video' ? '📹' : '📞',
    });
  };

  return (
    <div className="h-16 px-4 bg-white dark:bg-dark-header border-b border-gray-200 dark:border-gray-800 flex items-center justify-between select-none z-10 transition-colors">
      {/* Left section: Back button + Avatar + Name & Status */}
      <div className="flex items-center space-x-3 min-w-0">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="md:hidden p-1.5 -ml-1 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-input transition-colors"
            aria-label="Back to conversations"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}

        <Avatar
          src={avatarSrc}
          name={conversationName}
          isGroup={isGroup}
          isOnline={isOnline}
          showOnlineDot={!isGroup}
          size="md"
        />

        <div className="min-w-0">
          <h2 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
            {conversationName}
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {getSubStatus()}
          </p>
        </div>
      </div>

      {/* Right section: Call icons + More Menu */}
      <div className="flex items-center space-x-1 sm:space-x-2">
        <button
          type="button"
          onClick={() => handleCall('voice')}
          className="p-2 rounded-full text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-input transition-colors"
          title="Voice Call"
        >
          <Phone className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        <button
          type="button"
          onClick={() => handleCall('video')}
          className="p-2 rounded-full text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-input transition-colors"
          title="Video Call"
        >
          <Video className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        {/* Dropdown Menu */}
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setShowMenu((prev) => !prev)}
            className="p-2 rounded-full text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-input transition-colors"
            title="Menu"
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          {showMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-dark-header rounded-xl shadow-xl border border-gray-100 dark:border-gray-800 py-1.5 z-40 animate-fade-in">
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  onViewProfile?.(otherParticipant || conversation);
                }}
                className="w-full flex items-center px-4 py-2 text-xs sm:text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-input transition-colors"
              >
                <User className="w-4 h-4 mr-2.5 text-gray-400" />
                Contact Info
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  onClearChat?.(conversation);
                }}
                className="w-full flex items-center px-4 py-2 text-xs sm:text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-input transition-colors"
              >
                <Trash2 className="w-4 h-4 mr-2.5 text-gray-400" />
                Clear Chat
              </button>

              <div className="my-1 border-t border-gray-100 dark:border-gray-800" />

              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  toast.success('User blocked');
                }}
                className="w-full flex items-center px-4 py-2 text-xs sm:text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
              >
                <Slash className="w-4 h-4 mr-2.5" />
                Block
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  toast.success('Report submitted');
                }}
                className="w-full flex items-center px-4 py-2 text-xs sm:text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
              >
                <ShieldAlert className="w-4 h-4 mr-2.5" />
                Report
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatHeader;
