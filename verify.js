#!/usr/bin/env node
/**
 * Integration verification script
 * Run after both backend and frontend are built
 * Usage: node verify.js
 */

const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname);
const BACKEND = path.join(BASE, 'Backend');
const FRONTEND = path.join(BASE, 'Frontend');

const requiredBackendFiles = [
  'package.json',
  '.env.example',
  'src/server.js',
  'src/app.js',
  'src/config/db.js',
  'src/config/imagekit.js',
  'src/models/user.model.js',
  'src/models/conversation.model.js',
  'src/models/message.model.js',
  'src/models/refreshToken.model.js',
  'src/controllers/auth.controller.js',
  'src/controllers/user.controller.js',
  'src/controllers/conversation.controller.js',
  'src/controllers/message.controller.js',
  'src/controllers/media.controller.js',
  'src/controllers/group.controller.js',
  'src/routes/auth.routes.js',
  'src/routes/user.routes.js',
  'src/routes/conversation.routes.js',
  'src/routes/message.routes.js',
  'src/routes/media.routes.js',
  'src/routes/group.routes.js',
  'src/middleware/auth.middleware.js',
  'src/middleware/upload.middleware.js',
  'src/middleware/error.middleware.js',
  'src/services/imagekit.service.js',
  'src/services/socket.service.js',
  'src/sockets/chat.socket.js',
];

const requiredFrontendFiles = [
  'package.json',
  '.env.example',
  'vite.config.js',
  'tailwind.config.js',
  'postcss.config.js',
  'index.html',
  'src/main.jsx',
  'src/App.jsx',
  'src/index.css',
  'src/services/api.js',
  'src/services/socket.js',
  'src/context/AuthContext.jsx',
  'src/context/SocketContext.jsx',
  'src/hooks/useConversations.js',
  'src/hooks/useMessages.js',
  'src/hooks/useTheme.js',
  'src/pages/Login.jsx',
  'src/pages/Register.jsx',
  'src/pages/Chat.jsx',
  'src/pages/Profile.jsx',
  'src/components/sidebar/Sidebar.jsx',
  'src/components/sidebar/ConversationList.jsx',
  'src/components/sidebar/ConversationItem.jsx',
  'src/components/sidebar/NewChatModal.jsx',
  'src/components/chat/ChatArea.jsx',
  'src/components/chat/ChatHeader.jsx',
  'src/components/messages/MessageList.jsx',
  'src/components/messages/MessageBubble.jsx',
  'src/components/messages/MessageInput.jsx',
  'src/components/messages/EmojiPicker.jsx',
  'src/components/messages/ReplyPreview.jsx',
  'src/components/media/MediaPreview.jsx',
  'src/components/media/FileUploadPreview.jsx',
  'src/components/common/Avatar.jsx',
  'src/components/common/LoadingSkeleton.jsx',
  'src/components/common/ProtectedRoute.jsx',
  'src/components/common/PublicRoute.jsx',
  'src/components/common/ThemeToggle.jsx',
  'src/components/common/Modal.jsx',
  'src/components/common/Button.jsx',
  'src/utils/formatters.js',
  'src/utils/validators.js',
];

let missing = [];
let found = 0;

console.log('\n=== ChatApp Integration Verification ===\n');

console.log('--- Backend Files ---');
for (const file of requiredBackendFiles) {
  const fullPath = path.join(BACKEND, file);
  if (fs.existsSync(fullPath)) {
    console.log(`  ✅ ${file}`);
    found++;
  } else {
    console.log(`  ❌ MISSING: ${file}`);
    missing.push(`Backend/${file}`);
  }
}

console.log('\n--- Frontend Files ---');
for (const file of requiredFrontendFiles) {
  const fullPath = path.join(FRONTEND, file);
  if (fs.existsSync(fullPath)) {
    console.log(`  ✅ ${file}`);
    found++;
  } else {
    console.log(`  ❌ MISSING: ${file}`);
    missing.push(`Frontend/${file}`);
  }
}

console.log('\n--- Root Files ---');
const rootFiles = ['README.md', 'SECURITY.md'];
for (const file of rootFiles) {
  const fullPath = path.join(BASE, file);
  if (fs.existsSync(fullPath)) {
    console.log(`  ✅ ${file}`);
    found++;
  } else {
    console.log(`  ❌ MISSING: ${file}`);
    missing.push(file);
  }
}

const total = requiredBackendFiles.length + requiredFrontendFiles.length + rootFiles.length;
console.log(`\n=== Results: ${found}/${total} files present ===`);

if (missing.length > 0) {
  console.log('\nMissing files:');
  missing.forEach(f => console.log(`  - ${f}`));
  process.exit(1);
} else {
  console.log('\n✅ All required files are present!');
  process.exit(0);
}

