import React from 'react';
import { X, FileText, Music, Video, Image, File } from 'lucide-react';
import { formatFileSize } from '../../utils/formatters';

export const FileUploadPreview = ({ file, onRemove, uploadProgress = null }) => {
  if (!file) return null;

  const isImage = file.type?.startsWith('image/');
  const isVideo = file.type?.startsWith('video/');
  const isAudio = file.type?.startsWith('audio/');

  const renderIcon = () => {
    if (isImage) return <Image className="w-8 h-8 text-primary-500" />;
    if (isVideo) return <Video className="w-8 h-8 text-blue-500" />;
    if (isAudio) return <Music className="w-8 h-8 text-purple-500" />;
    if (file.type?.includes('pdf') || file.type?.includes('text')) {
      return <FileText className="w-8 h-8 text-amber-500" />;
    }
    return <File className="w-8 h-8 text-gray-500" />;
  };

  const previewUrl =
    isImage || isVideo ? URL.createObjectURL(file) : null;

  return (
    <div className="relative p-3 mb-2 bg-gray-50 dark:bg-dark-input rounded-xl border border-gray-200 dark:border-gray-700/60 shadow-sm flex items-center space-x-3 transition-all">
      {/* Thumbnail or Icon */}
      <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
        {isImage && previewUrl ? (
          <img
            src={previewUrl}
            alt={file.name}
            className="w-full h-full object-cover"
          />
        ) : isVideo && previewUrl ? (
          <video
            src={previewUrl}
            className="w-full h-full object-cover"
            muted
          />
        ) : (
          renderIcon()
        )}
      </div>

      {/* File Information */}
      <div className="flex-1 min-w-0 pr-8">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
          {file.name}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {formatFileSize(file.size)}
        </p>

        {/* Upload progress bar */}
        {uploadProgress !== null && uploadProgress < 100 && (
          <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-primary-500 h-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        )}
      </div>

      {/* Remove Button */}
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-2 right-2 p-1 rounded-full bg-gray-200/80 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-colors"
        title="Remove file"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default FileUploadPreview;
