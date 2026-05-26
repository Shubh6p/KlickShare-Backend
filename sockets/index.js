const registerRoomHandlers = require('./roomHandler');
const registerSignalHandlers = require('./signalHandler');

/**
 * Hook up real-time Socket.io communication handlers
 * @param {Server} io - Socket.io Server instance
 */
const initSockets = (io) => {
  io.on('connection', (socket) => {
    // Bind room lifecycle event handlers
    registerRoomHandlers(io, socket);
    
    // Bind WebRTC peer signaling relay handlers
    registerSignalHandlers(io, socket);
  });
};

module.exports = initSockets;
