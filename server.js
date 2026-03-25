require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const RoomManager = require('./room-manager');

const app = express();
const server = http.createServer(app);

// Open CORS for prototyping
app.use(cors({ origin: '*' }));

// Initialize Socket.io with open CORS
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Initialize Managers
const roomManager = new RoomManager(
  parseInt(process.env.ROOM_CODE_LENGTH) || 6,
  parseInt(process.env.MAX_ROOM_SIZE) || 2
);

// Helper for ICE Servers payload
const getIceServers = () => {
  return [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: process.env.STUN_URL || 'stun:stun.openrelay.metered.ca:80'
    },
    {
      urls: process.env.TURN_URL || 'turn:openrelay.metered.ca:80',
      username: process.env.TURN_USERNAME || 'openrelayproject',
      credential: process.env.TURN_PASSWORD || 'openrelayproject'
    }
  ];
};

// Application State tracking for socket->room mapping
const peerToRoomMap = new Map();

io.on('connection', (socket) => {
  // CREATE ROOM
  socket.on('create-room', (callback) => {
    const roomCode = roomManager.createRoom();
    roomManager.joinRoom(roomCode, socket.id);
    socket.join(roomCode);
    peerToRoomMap.set(socket.id, roomCode);

    if (typeof callback === 'function') {
      callback({
        success: true,
        roomCode,
        iceServers: getIceServers()
      });
    }
  });

  // JOIN ROOM
  socket.on('join-room', (data, callback) => {
    const { roomCode } = data;
    const result = roomManager.joinRoom(roomCode, socket.id);

    if (!result.success) {
      if (typeof callback === 'function') {
        callback({ success: false, error: result.error });
      }
      return;
    }

    socket.join(roomCode);
    peerToRoomMap.set(socket.id, roomCode);

    // Notify others in room
    socket.to(roomCode).emit('peer-joined', { peerId: socket.id });

    if (typeof callback === 'function') {
      callback({
        success: true,
        roomCode,
        iceServers: getIceServers()
      });
    }
  });

  // WEBRTC SIGNALING: OFFER
  socket.on('signal-offer', (data) => {
    const roomCode = peerToRoomMap.get(socket.id);
    if (roomCode) {
      socket.to(roomCode).emit('signal-offer', { offer: data.offer, from: socket.id });
    }
  });

  // WEBRTC SIGNALING: ANSWER
  socket.on('signal-answer', (data) => {
    const roomCode = peerToRoomMap.get(socket.id);
    if (roomCode) {
      socket.to(roomCode).emit('signal-answer', { answer: data.answer, from: socket.id });
    }
  });

  // WEBRTC SIGNALING: ICE CANDIDATE
  socket.on('signal-ice-candidate', (data) => {
    const roomCode = peerToRoomMap.get(socket.id);
    if (roomCode) {
      socket.to(roomCode).emit('signal-ice-candidate', { candidate: data.candidate, from: socket.id });
    }
  });

  // DISCONNECT
  socket.on('disconnect', () => {
    if (peerToRoomMap.has(socket.id)) {
      const roomCode = peerToRoomMap.get(socket.id);
      socket.to(roomCode).emit('peer-left', { peerId: socket.id });
      roomManager.leaveRoom(roomCode, socket.id);
      peerToRoomMap.delete(socket.id);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`+===========================================+`);
  console.log(`|        Klicks Server Started              |`);
  console.log(`|===========================================|`);
  console.log(`|  Port:     ${PORT}                       |`);
  console.log(`|  Mode:     ${process.env.NODE_ENV || 'development'}               |`);
  console.log(`+===========================================+`);
});
