const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const connectDB = require('./config/db');
const socketService = require('./services/socket.service');
const initChatSocket = require('./sockets/chat.socket');

const PORT = process.env.PORT || 5000;
const CLIENT_ORIGINS = (process.env.CLIENT_ORIGINS || process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// Connect to Database
connectDB();

// Create HTTP Server
const server = http.createServer(app);

// Setup Socket.IO Server with strict CORS
const io = new Server(server, {
  cors: {
    origin: CLIENT_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Save IO instance into singleton service
socketService.setIO(io);

// Initialize Chat Socket handler
initChatSocket(io);

// Start listening
server.listen(PORT, () => {
  console.log(`[Server] Server listening on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  console.log(`[Server] Socket.IO running, accepting connections from: ${CLIENT_ORIGINS.join(', ')}`);
});

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  console.log(`\n[Server] Received ${signal}. Starting graceful shutdown...`);

  server.close(async () => {
    console.log('[Server] HTTP server closed.');
    try {
      const mongoose = require('mongoose');
      await mongoose.connection.close(false);
      console.log('[DB] MongoDB connection closed.');
      process.exit(0);
    } catch (dbErr) {
      console.error('[DB] Error during disconnection:', dbErr.message);
      process.exit(1);
    }
  });

  // Force shutdown after timeout if connections hang
  setTimeout(() => {
    console.error('[Server] Forceful shutdown initiated due to timeout.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (err) => {
  console.error('[Server] Unhandled Promise Rejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('[Server] Uncaught Exception:', err);
  process.exit(1);
});
