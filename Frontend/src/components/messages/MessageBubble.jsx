import React, { useState, useRef, useEffect } from 'react';
import DOMPurify from 'dompurify';
import {
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  FileText,
  Download,
  MoreVertical,
  Reply,
  Smile,
  Edit2,
  Trash2,
  Copy,
  Ban,
} from 'lucide-react';
import { formatTime, formatFileSize } from '../../utils/formatters';
import Avatar from '../common/Avatar';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export const MessageBubble = ({
  message,
  isOwn = false,
  showAvatar = true,
  onReply,
  onDelete,
  onEdit,
  onReact,
  onMediaClick,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content || '');
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
        setShowReactionPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCopy = () => {
    if (message.content) {
      navigator.clipboard.writeText(message.content);
    }
    setShowMenu(false);
  };

  const handleSaveEdit = () => {
    if (editContent.trim() && editContent !== message.content) {
      onEdit?.(message._id || message.id, editContent.trim());
    }
    setIsEditing(false);
    setShowMenu(false);
  };

  const renderStatusIcon = () => {
    if (!isOwn) return null;

    if (message.status === 'sending') {
      return <Clock className="w-3.5 h-3.5 text-gray-400 animate-pulse ml-1 inline" />;
    }
    if (message.status === 'failed') {
      return <AlertCircle className="w-3.5 h-3.5 text-red-500 ml-1 inline" />;
    }
    if (message.status === 'read') {
      return <CheckCheck className="w-4 h-4 text-sky-500 ml-1 inline" />;
    }
    if (message.status === 'delivered') {
      return <CheckCheck className="w-4 h-4 text-gray-500 dark:text-gray-400 ml-1 inline" />;
    }
    // sent
    return <Check className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400 ml-1 inline" />;
  };

  const renderMedia = () => {
    if (!message.mediaUrl || message.isDeleted) return null;

    const mediaType = message.mediaType || message.messageType || '';

    if (mediaType.startsWith('image')) {
      return (
        <div className="mb-1 rounded-xl overflow-hidden cursor-pointer bg-black/5 dark:bg-white/5">
          <img
            src={message.mediaUrl}
            alt={message.mediaName || 'Sent image'}
            onClick={() =>
              onMediaClick?.({
                url: message.mediaUrl,
                type: 'image',
                name: message.mediaName,
              })
            }
            className="max-h-72 w-full object-cover rounded-xl hover:opacity-95 transition-opacity"
            loading="lazy"
          />
        </div>
      );
    }

    if (mediaType.startsWith('video')) {
      return (
        <div className="mb-1 rounded-xl overflow-hidden bg-black/10 dark:bg-white/5">
          <video
            src={message.mediaUrl}
            controls
            className="max-h-72 w-full rounded-xl object-contain"
          />
        </div>
      );
    }

    if (mediaType.startsWith('audio')) {
      return (
        <div className="mb-1 p-2 rounded-xl bg-gray-100/80 dark:bg-dark-input/60">
          <audio src={message.mediaUrl} controls className="w-full h-10 outline-none" />
        </div>
      );
    }

    // Generic document
    return (
      <div className="flex items-center space-x-3 p-3 mb-1 bg-gray-100/70 dark:bg-dark-input/50 rounded-xl border border-gray-200/50 dark:border-gray-700/50">
        <div className="p-2.5 bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400 rounded-lg">
          <FileText className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
            {message.mediaName || 'Document'}
          </p>
          {message.mediaSize && (
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
              {formatFileSize(message.mediaSize)}
            </p>
          )}
        </div>
        <a
          href={message.mediaUrl}
          download={message.mediaName || 'file'}
          target="_blank"
          rel="noreferrer"
          className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          title="Download file"
        >
          <Download className="w-4 h-4" />
        </a>
      </div>
    );
  };

  const senderName =
    typeof message.sender === 'object'
      ? message.sender?.username || message.sender?.name
      : null;

  return (
    <div
      className={`group relative flex items-end space-x-2 my-1 px-2 ${
        isOwn ? 'justify-end' : 'justify-start'
      }`}
    >
      {/* Sender Avatar if incoming and enabled */}
      {!isOwn && showAvatar && (
        <Avatar
          src={message.sender?.avatar}
          name={senderName || 'User'}
          size="sm"
          className="mb-1"
        />
      )}

      {/* Main Message Bubble */}
      <div
        className={`relative max-w-[85%] sm:max-w-[70%] md:max-w-[65%] px-3.5 py-2 shadow-xs transition-shadow ${
          isOwn
            ? 'bubble-outgoing rounded-tr-xs'
            : 'bubble-incoming rounded-tl-xs'
        }`}
      >
        {/* Reply preview bar */}
        {message.replyTo && (
          <div className="mb-1.5 p-2 bg-black/5 dark:bg-white/5 border-l-3 border-primary-500 rounded-r-lg text-xs">
            <p className="font-semibold text-primary-700 dark:text-primary-400 text-[11px] truncate">
              {typeof message.replyTo.sender === 'object'
                ? message.replyTo.sender?.username || 'User'
                : 'User'}
            </p>
            <p className="text-gray-600 dark:text-gray-300 truncate text-[11px] mt-0.5">
              {message.replyTo.isDeleted
                ? 'This message was deleted'
                : message.replyTo.content || 'Media attachment'}
            </p>
          </div>
        )}

        {/* Sender username for group chats */}
        {!isOwn && senderName && (
          <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mb-0.5 select-none">
            {senderName}
          </p>
        )}

        {/* Media content */}
        {renderMedia()}

        {/* Text content or deleted indicator */}
        {message.isDeleted ? (
          <div className="flex items-center space-x-1.5 text-xs italic text-gray-500 dark:text-gray-400 py-0.5">
            <Ban className="w-3.5 h-3.5 text-gray-400" />
            <span>This message was deleted</span>
          </div>
        ) : isEditing ? (
          <div className="pt-1 pb-2 min-w-[200px]">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full text-sm p-1.5 bg-white dark:bg-dark-input rounded border border-primary-400 outline-none resize-none"
              rows={2}
            />
            <div className="flex justify-end space-x-1 mt-1 text-xs">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-2 py-0.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-2 py-0.5 bg-primary-500 text-white rounded hover:bg-primary-600"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          message.content && (
            <div
              className="text-[13.5px] leading-relaxed break-words whitespace-pre-wrap select-text text-gray-900 dark:text-gray-100"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(message.content),
              }}
            />
          )
        )}

        {/* Time and Status Footer */}
        <div className="flex items-center justify-end space-x-1 mt-0.5 select-none text-[10px] text-gray-500 dark:text-gray-400">
          {message.isEdited && !message.isDeleted && (
            <span className="italic mr-1 text-[9px]">edited</span>
          )}
          <span>{formatTime(message.createdAt)}</span>
          {renderStatusIcon()}
        </div>

        {/* Reactions List */}
        {message.reactions && message.reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1 pt-1 -mb-1">
            {Object.entries(
              message.reactions.reduce((acc, r) => {
                acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                return acc;
              }, {})
            ).map(([emoji, count]) => (
              <button
                key={emoji}
                onClick={() => onReact?.(message._id || message.id, emoji)}
                className="inline-flex items-center space-x-0.5 px-1.5 py-0.5 bg-white/80 dark:bg-dark-header/80 rounded-full text-xs shadow-xs border border-gray-200/50 dark:border-gray-700/50 hover:scale-105 transition-transform"
                title={`${count} reactions`}
              >
                <span>{emoji}</span>
                {count > 1 && (
                  <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-300">
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Floating Action Menu Trigger (Visible on Hover) */}
      {!message.isDeleted && (
        <div
          ref={menuRef}
          className={`opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1 mb-1 ${
            isOwn ? 'order-first' : 'order-last'
          }`}
        >
          {/* Reaction Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowReactionPicker((p) => !p)}
              className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-header transition-colors"
              title="React"
            >
              <Smile className="w-4 h-4" />
            </button>

            {/* Quick Reactions Bar */}
            {showReactionPicker && (
              <div
                className={`absolute bottom-full mb-1 flex items-center space-x-1 p-1.5 bg-white dark:bg-dark-header rounded-full shadow-xl border border-gray-200 dark:border-gray-700 z-30 ${
                  isOwn ? 'right-0' : 'left-0'
                }`}
              >
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => {
                      onReact?.(message._id || message.id, emoji);
                      setShowReactionPicker(false);
                    }}
                    className="p-1 text-base hover:scale-125 transition-transform"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* More options button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMenu((p) => !p)}
              className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-header transition-colors"
              title="More"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {/* Context Dropdown */}
            {showMenu && (
              <div
                className={`absolute bottom-full mb-1 w-36 bg-white dark:bg-dark-header rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 py-1 z-30 ${
                  isOwn ? 'right-0' : 'left-0'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    onReply?.(message);
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-input transition-colors"
                >
                  <Reply className="w-3.5 h-3.5 mr-2" />
                  Reply
                </button>
                {message.content && (
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="w-full flex items-center px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-input transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5 mr-2" />
                    Copy text
                  </button>
                )}
                {isOwn && message.content && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(true);
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-input transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5 mr-2" />
                    Edit
                  </button>
                )}
                {isOwn && (
                  <button
                    type="button"
                    onClick={() => {
                      onDelete?.(message._id || message.id);
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-2" />
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageBubble;
