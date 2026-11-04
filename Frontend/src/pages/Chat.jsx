import React, { useState, useEffect } from 'react';
import Sidebar from '../components/sidebar/Sidebar';
import ChatArea from '../components/chat/ChatArea';
import Modal from '../components/common/Modal';
import Avatar from '../components/common/Avatar';
import useConversations from '../hooks/useConversations';
import { Mail, Calendar, User, Users } from 'lucide-react';
import { formatDate } from '../utils/formatters';

export const Chat = () => {
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [viewingProfile, setViewingProfile] = useState(null);

  const {
    conversations,
    setConversations,
    loading,
    markAsRead,
  } = useConversations(selectedConversation?._id || selectedConversation?.id);

  // Sync selected conversation object if updated in conversations list
  useEffect(() => {
    if (selectedConversation) {
      const activeId = selectedConversation._id || selectedConversation.id;
      const updated = conversations.find(
        (c) => (c._id || c.id) === activeId
      );
      if (updated) {
        setSelectedConversation((prev) => ({
          ...prev,
          ...updated,
        }));
      }
    }
  }, [conversations]);

  const handleSelectConversation = (conv) => {
    setSelectedConversation(conv);
    const convId = conv._id || conv.id;
    markAsRead(convId);
  };

  const handleConversationCreated = (newConv) => {
    if (!newConv) return;
    const convId = newConv._id || newConv.id;

    setConversations((prev) => {
      const exists = prev.some((c) => (c._id || c.id) === convId);
      if (exists) return prev;
      return [newConv, ...prev];
    });

    setSelectedConversation(newConv);
  };

  const handleBackToSidebar = () => {
    setSelectedConversation(null);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-chat-bg dark:bg-dark-bg transition-colors">
      {/* Sidebar Panel */}
      {/* On desktop: always visible with fixed width. On mobile: visible when no conversation is selected */}
      <div
        className={`${
          selectedConversation ? 'hidden md:flex' : 'flex'
        } w-full md:w-auto h-full flex-shrink-0`}
      >
        <Sidebar
          conversations={conversations}
          loading={loading}
          selectedConversationId={
            selectedConversation?._id || selectedConversation?.id
          }
          onSelectConversation={handleSelectConversation}
          onConversationCreated={handleConversationCreated}
        />
      </div>

      {/* Chat Area Panel */}
      {/* On desktop: always visible (showing placeholder or active chat). On mobile: visible only when chat is selected */}
      <div
        className={`${
          selectedConversation ? 'flex' : 'hidden md:flex'
        } flex-1 h-full min-w-0`}
      >
        <ChatArea
          conversation={selectedConversation}
          onBack={handleBackToSidebar}
          onViewProfile={(profileData) => setViewingProfile(profileData)}
        />
      </div>

      {/* User / Group Info Modal */}
      {viewingProfile && (
        <Modal
          isOpen={!!viewingProfile}
          onClose={() => setViewingProfile(null)}
          title={
            viewingProfile.name || viewingProfile.username
              ? `${viewingProfile.username || viewingProfile.name}'s Info`
              : 'Contact Details'
          }
        >
          <div className="flex flex-col items-center py-4 text-center">
            <Avatar
              src={viewingProfile.avatar || viewingProfile.groupImage}
              name={viewingProfile.username || viewingProfile.name}
              size="2xl"
              isGroup={!!viewingProfile.participants}
              className="mb-4"
            />
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {viewingProfile.username || viewingProfile.name}
            </h3>

            {viewingProfile.email && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center space-x-1">
                <Mail className="w-3.5 h-3.5 mr-1 inline" />
                <span>{viewingProfile.email}</span>
              </p>
            )}

            {viewingProfile.bio && (
              <div className="w-full mt-5 p-3 rounded-xl bg-gray-50 dark:bg-dark-input text-left text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                <span className="font-semibold block text-[11px] uppercase tracking-wider text-gray-400 mb-1">
                  About
                </span>
                <p>{viewingProfile.bio}</p>
              </div>
            )}

            {viewingProfile.createdAt && (
              <div className="w-full mt-3 text-left text-xs text-gray-500 flex items-center space-x-1.5 px-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>Joined {formatDate(viewingProfile.createdAt)}</span>
              </div>
            )}

            {/* If Group: List members */}
            {viewingProfile.participants && (
              <div className="w-full mt-4 text-left">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center">
                  <Users className="w-3.5 h-3.5 mr-1" />
                  Members ({viewingProfile.participants.length})
                </h4>
                <div className="max-h-40 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
                  {viewingProfile.participants.map((member) => (
                    <div
                      key={member._id || member.id}
                      className="flex items-center space-x-2 py-2"
                    >
                      <Avatar
                        src={member.avatar}
                        name={member.username || 'Member'}
                        size="sm"
                      />
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                        {member.username || 'Member'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Chat;
