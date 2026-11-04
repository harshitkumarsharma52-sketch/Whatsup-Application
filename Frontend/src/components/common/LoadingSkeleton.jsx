import React from 'react';

export const ConversationItemSkeleton = () => {
  return (
    <div className="flex items-center px-4 py-3 space-x-3 animate-pulse border-b border-gray-100 dark:border-gray-800/40">
      <div className="w-12 h-12 bg-gray-200 dark:bg-gray-800 rounded-full flex-shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex justify-between items-center">
          <div className="w-28 h-4 bg-gray-200 dark:bg-gray-800 rounded" />
          <div className="w-12 h-3 bg-gray-200 dark:bg-gray-800 rounded" />
        </div>
        <div className="w-40 h-3 bg-gray-200 dark:bg-gray-800 rounded" />
      </div>
    </div>
  );
};

export const MessageBubbleSkeleton = ({ incoming = true }) => {
  return (
    <div
      className={`flex items-end space-x-2 my-2 animate-pulse ${
        incoming ? 'justify-start' : 'justify-end'
      }`}
    >
      {incoming && (
        <div className="w-7 h-7 bg-gray-200 dark:bg-gray-800 rounded-full flex-shrink-0" />
      )}
      <div
        className={`rounded-2xl px-4 py-3 space-y-2 ${
          incoming
            ? 'bg-white dark:bg-dark-bubble_in w-56 rounded-tl-xs'
            : 'bg-primary-100 dark:bg-dark-bubble_out w-56 rounded-tr-xs'
        }`}
      >
        <div className="h-3.5 bg-gray-200 dark:bg-gray-700/60 rounded w-4/5" />
        <div className="h-3 bg-gray-200 dark:bg-gray-700/60 rounded w-3/5" />
        <div className="flex justify-end pt-1">
          <div className="h-2.5 bg-gray-200 dark:bg-gray-700/60 rounded w-10" />
        </div>
      </div>
    </div>
  );
};

export const ProfileSkeleton = () => {
  return (
    <div className="max-w-md mx-auto p-6 space-y-6 animate-pulse">
      <div className="flex flex-col items-center space-y-3">
        <div className="w-24 h-24 bg-gray-200 dark:bg-gray-800 rounded-full" />
        <div className="w-32 h-5 bg-gray-200 dark:bg-gray-800 rounded" />
        <div className="w-48 h-3.5 bg-gray-200 dark:bg-gray-800 rounded" />
      </div>
      <div className="space-y-4 pt-4">
        <div className="h-10 bg-gray-200 dark:bg-gray-800 rounded-lg" />
        <div className="h-10 bg-gray-200 dark:bg-gray-800 rounded-lg" />
        <div className="h-20 bg-gray-200 dark:bg-gray-800 rounded-lg" />
      </div>
    </div>
  );
};

export const ConversationListSkeleton = ({ count = 6 }) => {
  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-800/40">
      {Array.from({ length: count }).map((_, index) => (
        <ConversationItemSkeleton key={index} />
      ))}
    </div>
  );
};

export default {
  ConversationItemSkeleton,
  MessageBubbleSkeleton,
  ProfileSkeleton,
  ConversationListSkeleton,
};
