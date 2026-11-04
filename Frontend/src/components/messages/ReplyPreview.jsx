import React from 'react';
import { X, Reply, Image, Video, FileText } from 'lucide-react';
import { truncateText } from '../../utils/formatters';

export const ReplyPreview = ({ replyTo, onCancel }) => {
  if (!replyTo) return null;

  const senderName =
    typeof replyTo.sender === 'object'
      ? replyTo.sender?.username || replyTo.sender?.name || 'Someone'
      : 'Someone';

  const getContentPreview = () => {
    if (replyTo.isDeleted) return 'This message was deleted';
    if (replyTo.content) return truncateText(replyTo.content, 60);
    if (replyTo.mediaType?.startsWith('image/')) return '📷 Photo';
    if (replyTo.mediaType?.startsWith('video/')) return '🎥 Video';
    if (replyTo.mediaType?.startsWith('audio/')) return '🎵 Audio';
    if (replyTo.mediaUrl) return '📎 Attachment';
    return 'Message';
  };

  return (
    <div className="flex items-center justify-between px-3 py-2 bg-gray-100 dark:bg-dark-input/80 border-l-4 border-primary-500 rounded-r-lg mb-2 text-xs">
      <div className="flex items-start space-x-2 min-w-0 pr-2">
        <Reply className="w-4 h-4 text-primary-500 flex-shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="font-semibold text-primary-600 dark:text-primary-400 truncate">
            {senderName}
          </p>
          <p className="text-gray-600 dark:text-gray-300 truncate mt-0.5">
            {getContentPreview()}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
        title="Cancel reply"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default ReplyPreview;
