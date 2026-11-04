import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageSquarePlus,
  Search,
  Settings,
  LogOut,
  X,
  MessageCircle,
} from 'lucide-react';
import ConversationList from './ConversationList';
import NewChatModal from './NewChatModal';
import Avatar from '../common/Avatar';
import ThemeToggle from '../common/ThemeToggle';
import { useAuth } from '../../context/AuthContext';

export const Sidebar = ({
  conversations = [],
  loading = false,
  selectedConversationId,
  onSelectConversation,
  onConversationCreated,
}) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <aside className="w-full md:w-80 lg:w-96 h-full flex flex-col bg-chat-sidebar dark:bg-dark-sidebar border-r border-gray-200 dark:border-gray-800 select-none transition-colors">
      {/* Header */}
      <div className="h-16 px-4 bg-chat-header dark:bg-dark-header border-b border-gray-200 dark:border-gray-800 flex items-center justify-between transition-colors">
        {/* User Info / Profile Link */}
        <div
          onClick={() => navigate('/profile')}
          className="flex items-center space-x-2.5 cursor-pointer group"
          title="View Profile"
        >
          <Avatar
            src={user?.avatar}
            name={user?.username || 'Me'}
            size="md"
            className="group-hover:ring-2 ring-primary-500 transition-all"
          />
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
              {user?.username || 'ChatApp'}
            </h1>
            <span className="text-[11px] text-gray-500 dark:text-gray-400">
              Online
            </span>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center space-x-1 text-gray-600 dark:text-gray-300">
          <ThemeToggle />

          <button
            type="button"
            onClick={() => setIsNewChatOpen(true)}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-dark-input text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            title="New Chat"
            aria-label="Start new conversation"
          >
            <MessageSquarePlus className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-dark-input text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            title="Settings"
            aria-label="Profile and Settings"
          >
            <Settings className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-950/30 text-gray-500 hover:text-red-600 transition-colors"
            title="Logout"
            aria-label="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="p-3 bg-white dark:bg-dark-sidebar border-b border-gray-100 dark:border-gray-800/60">
        <div className="relative flex items-center bg-chat-input dark:bg-dark-input rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-primary-500/50 transition-all">
          <Search className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search or start new chat"
            className="w-full bg-transparent text-xs sm:text-sm text-gray-900 dark:text-gray-100 placeholder-gray-500 outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="p-0.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Conversation List */}
      <ConversationList
        conversations={conversations}
        loading={loading}
        searchQuery={searchQuery}
        selectedConversationId={selectedConversationId}
        onSelectConversation={onSelectConversation}
      />

      {/* New Chat Modal */}
      <NewChatModal
        isOpen={isNewChatOpen}
        onClose={() => setIsNewChatOpen(false)}
        onConversationCreated={onConversationCreated}
      />
    </aside>
  );
};

export default Sidebar;
