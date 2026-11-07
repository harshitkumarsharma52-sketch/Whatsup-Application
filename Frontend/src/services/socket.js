import { io } from 'socket.io-client';
import { SOCKET_URL } from './apiUrl';

let socket = null;

/**
 * Initialize Socket.IO connection
 * @param {string} token
 * @returns {Socket}
 */
export const initSocket = (token) => {
  if (socket) {
    const previousToken = socket.auth?.token;
    socket.auth = { token };
    if (socket.connected && token && previousToken !== token) {
      socket.disconnect();
    }
    return socket;
  }

  socket = io(SOCKET_URL, {
    autoConnect: false,
    auth: {
      token,
    },
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    transports: ['websocket', 'polling'],
  });

  return socket;
};

/**
 * Retrieve active socket instance
 * @returns {Socket|null}
 */
export const getSocket = () => {
  return socket;
};

/**
 * Disconnect and clear socket instance
 */
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
