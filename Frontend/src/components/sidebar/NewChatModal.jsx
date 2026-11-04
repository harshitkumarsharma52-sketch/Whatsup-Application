import React, { useState, useEffect } from 'react';
import { Search, Users, UserPlus, Check, Loader2, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../common/Modal';
import Avatar from '../common/Avatar';
import Button from '../common/Button';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export const NewChatModal = ({
  isOpen,
  onClose,
  onConversationCreated,
}) => {
  const { user: currentUser } = useAuth();

  const [activeTab, setActiveTab] = useState('direct'); // 'direct' | 'group'
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Group creation state
  const [groupName, setGroupName] = useState('');
  const [groupImage, setGroupImage] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [isCreating, setIsCreating] = useState(false);

  // Debounced user search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        // Try /users/search?q= or /users?search=
        let res;
        try {
          res = await api.get('/users/search', {
            params: { q: searchQuery.trim() },
          });
        } catch {
          res = await api.get('/users', {
            params: { search: searchQuery.trim() },
          });
        }

        const usersList = Array.isArray(res.data)
          ? res.data
          : res.data?.users || res.data?.data || [];

        // Filter out current logged in user
        const filtered = usersList.filter(
          (u) => (u._id || u.id) !== (currentUser?._id || currentUser?.id)
        );

        setSearchResults(filtered);
      } catch (err) {
        console.error('Failed to search users:', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, currentUser]);

  const handleCreateDirectChat = async (targetUser) => {
    try {
      setIsCreating(true);
      const targetUserId = targetUser._id || targetUser.id;

      const res = await api.post('/conversations', {
        recipientId: targetUserId,
        participantId: targetUserId,
        isGroup: false,
      });

      const conv = res.data?.conversation || res.data?.data || res.data;
      toast.success(`Chat started with ${targetUser.username}`);
      onConversationCreated(conv);
      handleClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to start conversation');
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleSelectUser = (targetUser) => {
    const userId = targetUser._id || targetUser.id;
    if (selectedUsers.some((u) => (u._id || u.id) === userId)) {
      setSelectedUsers((prev) => prev.filter((u) => (u._id || u.id) !== userId));
    } else {
      setSelectedUsers((prev) => [...prev, targetUser]);
    }
  };

  const handleCreateGroupChat = async (e) => {
    e.preventDefault();
    if (!groupName.trim()) {
      toast.error('Please enter a group name');
      return;
    }
    if (selectedUsers.length === 0) {
      toast.error('Select at least one member for the group');
      return;
    }

    try {
      setIsCreating(true);
      const participantIds = selectedUsers.map((u) => u._id || u.id);

      const res = await api.post('/conversations', {
        name: groupName.trim(),
        participants: participantIds,
        isGroup: true,
        groupImage: groupImage.trim() || undefined,
      });

      const conv = res.data?.conversation || res.data?.data || res.data;
      toast.success(`Group "${groupName}" created!`);
      onConversationCreated(conv);
      handleClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create group');
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setSearchQuery('');
    setSearchResults([]);
    setGroupName('');
    setGroupImage('');
    setSelectedUsers([]);
    setActiveTab('direct');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="New Conversation">
      {/* Tabs */}
      <div className="flex border-b border-gray-100 dark:border-gray-800 -mt-2 mb-4">
        <button
          type="button"
          onClick={() => setActiveTab('direct')}
          className={`flex-1 py-2.5 text-xs sm:text-sm font-medium flex items-center justify-center space-x-2 border-b-2 transition-colors ${
            activeTab === 'direct'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400 font-semibold'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          <UserPlus className="w-4 h-4" />
          <span>Direct Message</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('group')}
          className={`flex-1 py-2.5 text-xs sm:text-sm font-medium flex items-center justify-center space-x-2 border-b-2 transition-colors ${
            activeTab === 'group'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400 font-semibold'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>New Group</span>
        </button>
      </div>

      {/* DIRECT MESSAGE TAB */}
      {activeTab === 'direct' && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by username or email..."
              className="w-full pl-9 pr-4 py-2 bg-gray-100 dark:bg-dark-input rounded-xl text-sm text-gray-900 dark:text-gray-100 placeholder-gray-500 outline-none focus:ring-2 focus:ring-primary-500 transition-all"
              autoFocus
            />
          </div>

          {/* Search Results */}
          <div className="max-h-60 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800/40">
            {isSearching ? (
              <div className="flex justify-center py-6 text-gray-400">
                <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
              </div>
            ) : searchResults.length > 0 ? (
              searchResults.map((targetUser) => {
                const id = targetUser._id || targetUser.id;
                return (
                  <div
                    key={id}
                    onClick={() => handleCreateDirectChat(targetUser)}
                    className="flex items-center px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-dark-input/60 rounded-xl cursor-pointer transition-colors"
                  >
                    <Avatar
                      src={targetUser.avatar}
                      name={targetUser.username}
                      size="sm"
                      className="mr-3"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {targetUser.username}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {targetUser.email}
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" disabled={isCreating}>
                      Chat
                    </Button>
                  </div>
                );
              })
            ) : searchQuery.trim() ? (
              <p className="text-center py-6 text-sm text-gray-400">
                No users found for "{searchQuery}"
              </p>
            ) : (
              <p className="text-center py-6 text-xs text-gray-400">
                Type a name or email to search for people to chat with.
              </p>
            )}
          </div>
        </div>
      )}

      {/* GROUP CHAT TAB */}
      {activeTab === 'group' && (
        <form onSubmit={handleCreateGroupChat} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Group Name *
            </label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g. Project Developers"
              className="w-full px-3.5 py-2 bg-gray-100 dark:bg-dark-input rounded-xl text-sm text-gray-900 dark:text-gray-100 placeholder-gray-500 outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Group Image URL (optional)
            </label>
            <div className="relative">
              <ImageIcon className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="url"
                value={groupImage}
                onChange={(e) => setGroupImage(e.target.value)}
                placeholder="https://example.com/image.png"
                className="w-full pl-9 pr-3.5 py-2 bg-gray-100 dark:bg-dark-input rounded-xl text-sm text-gray-900 dark:text-gray-100 placeholder-gray-500 outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Add Members ({selectedUsers.length} selected)
            </label>
            <div className="relative mb-2">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search users to add..."
                className="w-full pl-9 pr-4 py-2 bg-gray-100 dark:bg-dark-input rounded-xl text-xs sm:text-sm text-gray-900 dark:text-gray-100 placeholder-gray-500 outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Selected Users Chips */}
            {selectedUsers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2 max-h-20 overflow-y-auto p-1">
                {selectedUsers.map((u) => (
                  <span
                    key={u._id || u.id}
                    onClick={() => handleToggleSelectUser(u)}
                    className="inline-flex items-center space-x-1 px-2.5 py-1 bg-primary-100 dark:bg-primary-900/40 text-primary-800 dark:text-primary-300 rounded-full text-xs cursor-pointer hover:bg-primary-200"
                  >
                    <span>{u.username}</span>
                    <span className="font-bold">×</span>
                  </span>
                ))}
              </div>
            )}

            {/* User Search List */}
            <div className="max-h-40 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800/40">
              {searchResults.map((targetUser) => {
                const id = targetUser._id || targetUser.id;
                const isSelected = selectedUsers.some(
                  (u) => (u._id || u.id) === id
                );

                return (
                  <div
                    key={id}
                    onClick={() => handleToggleSelectUser(targetUser)}
                    className="flex items-center justify-between px-2 py-2 hover:bg-gray-50 dark:hover:bg-dark-input/60 rounded-lg cursor-pointer"
                  >
                    <div className="flex items-center space-x-2 min-w-0">
                      <Avatar
                        src={targetUser.avatar}
                        name={targetUser.username}
                        size="sm"
                      />
                      <span className="text-xs sm:text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                        {targetUser.username}
                      </span>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                        isSelected
                          ? 'bg-primary-500 border-primary-500 text-white'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-3" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <Button variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isCreating}
              disabled={!groupName.trim() || selectedUsers.length === 0}
            >
              Create Group
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default NewChatModal;
