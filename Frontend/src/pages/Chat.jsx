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

//   return (
//     <div className="flex h-screen w-screen overflow-hidden bg-chat-bg dark:bg-dark-bg transition-colors">
//       {/* Sidebar Panel */}
//       {/* On desktop: always visible with fixed width. On mobile: visible when no conversation is selected */}
//       <div
//         className={`${
//           selectedConversation ? 'hidden md:flex' : 'flex'
//         } w-full md:w-auto h-full flex-shrink-0`}
//       >
//         <Sidebar
//           conversations={conversations}
//           loading={loading}
//           selectedConversationId={
//             selectedConversation?._id || selectedConversation?.id
//           }
//           onSelectConversation={handleSelectConversation}
//           onConversationCreated={handleConversationCreated}
//         />
//       </div>

//       {/* Chat Area Panel */}
//       {/* On desktop: always visible (showing placeholder or active chat). On mobile: visible only when chat is selected */}
//       <div
//         className={`${
//           selectedConversation ? 'flex' : 'hidden md:flex'
//         } flex-1 h-full min-w-0`}
//       >
//         <ChatArea
//           conversation={selectedConversation}
//           onBack={handleBackToSidebar}
//           onViewProfile={(profileData) => setViewingProfile(profileData)}
//         />
//       </div>

//       {/* User / Group Info Modal */}
//       {viewingProfile && (
//         <Modal
//           isOpen={!!viewingProfile}
//           onClose={() => setViewingProfile(null)}
//           title={
//             viewingProfile.name || viewingProfile.username
//               ? `${viewingProfile.username || viewingProfile.name}'s Info`
//               : 'Contact Details'
//           }
//         >
//           <div className="flex flex-col items-center py-4 text-center">
//             <Avatar
//               src={viewingProfile.avatar || viewingProfile.groupImage}
//               name={viewingProfile.username || viewingProfile.name}
//               size="2xl"
//               isGroup={!!viewingProfile.participants}
//               className="mb-4"
//             />
//             <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
//               {viewingProfile.username || viewingProfile.name}
//             </h3>

//             {viewingProfile.email && (
//               <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center space-x-1">
//                 <Mail className="w-3.5 h-3.5 mr-1 inline" />
//                 <span>{viewingProfile.email}</span>
//               </p>
//             )}

//             {viewingProfile.bio && (
//               <div className="w-full mt-5 p-3 rounded-xl bg-gray-50 dark:bg-dark-input text-left text-xs sm:text-sm text-gray-700 dark:text-gray-300">
//                 <span className="font-semibold block text-[11px] uppercase tracking-wider text-gray-400 mb-1">
//                   About
//                 </span>
//                 <p>{viewingProfile.bio}</p>
//               </div>
//             )}

//             {viewingProfile.createdAt && (
//               <div className="w-full mt-3 text-left text-xs text-gray-500 flex items-center space-x-1.5 px-1">
//                 <Calendar className="w-3.5 h-3.5" />
//                 <span>Joined {formatDate(viewingProfile.createdAt)}</span>
//               </div>
//             )}

//             {/* If Group: List members */}
//             {viewingProfile.participants && (
//               <div className="w-full mt-4 text-left">
//                 <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center">
//                   <Users className="w-3.5 h-3.5 mr-1" />
//                   Members ({viewingProfile.participants.length})
//                 </h4>
//                 <div className="max-h-40 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
//                   {viewingProfile.participants.map((member) => (
//                     <div
//                       key={member._id || member.id}
//                       className="flex items-center space-x-2 py-2"
//                     >
//                       <Avatar
//                         src={member.avatar}
//                         name={member.username || 'Member'}
//                         size="sm"
//                       />
//                       <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
//                         {member.username || 'Member'}
//                       </span>
//                     </div>
//                   ))}
//                 </div>
//               </div>
//             )}
//           </div>
//         </Modal>
//       )}
//     </div>
//   );
// };
return (
    <div className="relative flex h-dvh w-full overflow-hidden bg-chat-bg antialiased transition-colors duration-300 dark:bg-dark-bg">
      {/* Sidebar Panel */}
      <div
        className={`${
          selectedConversation ? '-translate-x-full' : 'translate-x-0'
        } absolute inset-0 z-20 h-full w-full transform border-r border-gray-200/70 transition-transform duration-300 ease-out will-change-transform dark:border-white/10 md:relative md:inset-auto md:z-auto md:w-80 md:flex-shrink-0 md:translate-x-0 lg:w-96`}
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
      <div
        className={`${
          selectedConversation ? 'translate-x-0' : 'translate-x-full'
        } absolute inset-0 z-10 h-full w-full transform transition-transform duration-300 ease-out will-change-transform md:relative md:inset-auto md:z-auto md:flex md:min-w-0 md:flex-1 md:translate-x-0`}
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
          <div className="flex flex-col items-center px-1 py-4 text-center sm:px-2">
            <Avatar
              src={viewingProfile.profilePicture?.url || viewingProfile.avatar || viewingProfile.groupImage?.url || viewingProfile.groupImage}
              name={viewingProfile.username || viewingProfile.name}
              size="2xl"
              isGroup={!!viewingProfile.participants}
              className="mb-4 shadow-lg ring-4 ring-white dark:ring-dark-bg"
            />
            <h3 className="max-w-full truncate text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
              {viewingProfile.username || viewingProfile.name}
            </h3>

            {viewingProfile.email && (
              <p className="mt-1 flex max-w-full items-center justify-center text-xs text-gray-500 dark:text-gray-400 sm:text-sm">
                <Mail className="mr-1.5 inline h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{viewingProfile.email}</span>
              </p>
            )}

            {viewingProfile.bio && (
              <div className="mt-5 w-full rounded-2xl border border-gray-200/70 bg-gray-50 p-4 text-left text-xs leading-relaxed text-gray-700 dark:border-white/10 dark:bg-dark-input dark:text-gray-300 sm:text-sm">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  About
                </span>
                <p className="break-words">{viewingProfile.bio}</p>
              </div>
            )}

            {viewingProfile.createdAt && (
              <div className="mt-3 flex w-full items-center space-x-2 px-1 text-left text-xs text-gray-500 dark:text-gray-400">
                <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                <span>Joined {formatDate(viewingProfile.createdAt)}</span>
              </div>
            )}

            {/* If Group: List members */}
            {viewingProfile.participants && (
              <div className="mt-5 w-full text-left">
                <h4 className="mb-2 flex items-center px-1 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  <Users className="mr-1.5 h-3.5 w-3.5" />
                  Members ({viewingProfile.participants.length})
                </h4>
                <div className="max-h-44 divide-y divide-gray-100 overflow-y-auto rounded-2xl border border-gray-200/70 px-2 dark:divide-white/5 dark:border-white/10">
                  {viewingProfile.participants.map((member) => (
                    <div
                      key={member._id || member.id}
                      className="flex items-center space-x-3 rounded-lg px-1 py-2.5 transition-colors hover:bg-gray-50 dark:hover:bg-white/5"
                    >
                      <Avatar
                        src={member.profilePicture?.url || member.avatar}
                        name={member.username || 'Member'}
                        size="sm"
                      />
                      <span className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">
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
