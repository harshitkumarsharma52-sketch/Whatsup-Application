import React from 'react';
import ConversationItem from './ConversationItem';
import { ConversationListSkeleton } from '../common/LoadingSkeleton';
import { MessageSquareDashed } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const ConversationList = ({
  conversations = [],
  loading = false,
  searchQuery = '',
  selectedConversationId,
  onSelectConversation,
}) => {
  const { user } = useAuth();

  if (loading && conversations.length === 0) {
    return <ConversationListSkeleton count={6} />;
  }

  // Filter conversations by query
  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();

    const isGroup = conv.isGroup || conv.type === 'group';
    if (isGroup && conv.name?.toLowerCase().includes(query)) {
      return true;
    }

    const otherParticipant = conv.participants?.find(
      (p) => (p._id || p.id) !== (user?._id || user?.id)
    );

    if (otherParticipant) {
      if (
        otherParticipant.username?.toLowerCase().includes(query) ||
        otherParticipant.email?.toLowerCase().includes(query)
      ) {
        return true;
      }
    }

    // Also check last message content
    if (conv.lastMessage?.content?.toLowerCase().includes(query)) {
      return true;
    }

    return false;
  });

  if (filteredConversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 p-6 text-center text-gray-500 dark:text-gray-400">
        <MessageSquareDashed className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
        <p className="text-sm font-medium">
          {searchQuery ? 'No chats match your search' : 'No conversations yet'}
        </p>
        <p className="text-xs text-gray-400 mt-1 max-w-xs">
          {searchQuery
            ? 'Try searching for another user or start a new chat.'
            : 'Click the new chat button above to begin messaging!'}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto flex-1 divide-y divide-gray-100 dark:divide-gray-800/40">
      {filteredConversations.map((conv, index) => {
        const id = conv._id || conv.id;
        const isSelected = selectedConversationId === id;

        return (
          <ConversationItem
            key={id}
            conversation={conv}
            animationIndex={Math.min(index, 6)}
            isSelected={isSelected}
            onClick={() => onSelectConversation(conv)}
          />
        );
      })}
    </div>
  );
};

export default ConversationList;
