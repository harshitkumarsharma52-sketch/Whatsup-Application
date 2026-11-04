import React, { useState } from 'react';
import { Users } from 'lucide-react';
import { getInitials } from '../../utils/formatters';

const sizeMap = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-xl',
  '2xl': 'w-24 h-24 text-2xl',
};

const dotSizeMap = {
  sm: 'w-2.5 h-2.5 ring-1.5',
  md: 'w-3 h-3 ring-2',
  lg: 'w-3.5 h-3.5 ring-2',
  xl: 'w-4 h-4 ring-2',
  '2xl': 'w-5 h-5 ring-4',
};

export const Avatar = ({
  src,
  name = '',
  size = 'md',
  isOnline = false,
  showOnlineDot = false,
  isGroup = false,
  className = '',
}) => {
  const [imageError, setImageError] = useState(false);

  const sizeClass = sizeMap[size] || sizeMap.md;
  const dotClass = dotSizeMap[size] || dotSizeMap.md;

  const getBackgroundColor = (str) => {
    const colors = [
      'bg-emerald-500',
      'bg-blue-500',
      'bg-indigo-500',
      'bg-purple-500',
      'bg-rose-500',
      'bg-amber-500',
      'bg-teal-500',
      'bg-cyan-600',
    ];
    if (!str) return colors[0];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  return (
    <div className={`relative inline-block flex-shrink-0 ${className}`}>
      {src && !imageError ? (
        <img
          src={src}
          alt={name || 'Avatar'}
          onError={() => setImageError(true)}
          className={`${sizeClass} rounded-full object-cover shadow-sm bg-gray-200 dark:bg-gray-700`}
        />
      ) : isGroup ? (
        <div
          className={`${sizeClass} rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-sm`}
        >
          <Users className="w-1/2 h-1/2" />
        </div>
      ) : (
        <div
          className={`${sizeClass} rounded-full ${getBackgroundColor(
            name
          )} text-white font-semibold flex items-center justify-center shadow-sm select-none`}
        >
          {getInitials(name)}
        </div>
      )}

      {showOnlineDot && (
        <span
          className={`absolute bottom-0 right-0 rounded-full ring-white dark:ring-dark-bg ${dotClass} ${
            isOnline ? 'bg-green-500' : 'bg-gray-400 dark:bg-gray-500'
          }`}
          title={isOnline ? 'Online' : 'Offline'}
        />
      )}
    </div>
  );
};

export default Avatar;
