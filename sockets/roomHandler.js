const config = require('../config/env');
const roomService = require('../services/roomService');
const { setRoomCode, getRoomCode, deleteRoomMapping } = require('./state');

const registerRoomHandlers = (io, socket) => {
  // CREATE ROOM
  socket.on('create-room', (data, callback) => {
    let name = 'Anonymous';
    let maxSize = config.MAX_ROOM_SIZE;
    let cb = callback;
    let allowLateJoinerFiles = false;

    if (typeof data === 'function') {
      cb = data;
    } else if (data) {
      name = (data.name && typeof data.name === 'string') 
        ? data.name.substring(0, 30).trim() 
        : 'Anonymous';
      if (!name) name = 'Anonymous';
      
      maxSize = (typeof data.maxSize === 'number' && data.maxSize > 0 && data.maxSize <= 10) 
        ? data.maxSize 
        : config.MAX_ROOM_SIZE;
        
      allowLateJoinerFiles = !!data.allowLateJoinerFiles;
    }

    const roomCode = roomService.createRoom(maxSize, allowLateJoinerFiles);
    const result = roomService.joinRoom(roomCode, socket.id, name, true);
    
    socket.join(roomCode);
    setRoomCode(socket.id, roomCode);

    if (typeof cb === 'function') {
      cb({
        success: true,
        roomCode,
        iceServers: config.ICE_SERVERS,
        peerColor: result.color,
        peerList: roomService.getPeerList(roomCode)
      });
    }
  });

  // JOIN ROOM
  socket.on('join-room', (data, callback) => {
    if (!data || !data.roomCode) {
      if (typeof callback === 'function') {
        callback({ success: false, error: 'Invalid room code provided.' });
      }
      return;
    }

    let { roomCode, name = 'Anonymous' } = data;
    if (typeof name === 'string') {
      name = name.substring(0, 30).trim();
      if (!name) name = 'Anonymous';
    }

    const result = roomService.joinRoom(roomCode, socket.id, name, false);

    if (!result.success) {
      if (typeof callback === 'function') {
        callback({ success: false, error: result.error });
      }
      return;
    }

    socket.join(roomCode);
    setRoomCode(socket.id, roomCode);

    // Send updated peer list to EVERYONE in room (including new peer)
    const peerList = roomService.getPeerList(roomCode);
    io.to(roomCode).emit('peer-list-updated', { peerList });

    // Tell existing peers about the new joiner specifically
    socket.to(roomCode).emit('peer-joined', {
      peerId: socket.id,
      name,
      color: result.color
    });

    const roomInfo = roomService.getRoomInfo(roomCode) || { allowLateJoinerFiles: false, sharedFilesLog: [] };

    if (typeof callback === 'function') {
      callback({
        success: true,
        roomCode,
        iceServers: config.ICE_SERVERS,
        peerColor: result.color,
        peerList,
        allowLateJoinerFiles: roomInfo.allowLateJoinerFiles,
        sharedFilesLog: roomInfo.sharedFilesLog
      });
    }
  });

  // KILL ROOM
  socket.on('kill-room', (roomCode) => {
    if (roomService.isHost(roomCode, socket.id)) {
      socket.to(roomCode).emit('room-killed');
      roomService.deleteRoom(roomCode);
    }
  });

  // FILE SENT LOG
  socket.on('file-sent-log', (data) => {
    if (data && data.name) {
      const roomCode = getRoomCode(socket.id);
      if (roomCode) {
        roomService.addFileLog(roomCode, {
          name: data.name,
          size: data.size,
          senderName: (data.senderName || 'UNKNOWN').toUpperCase(),
          timestamp: Date.now()
        });
      }
    }
  });

  // DISCONNECT
  socket.on('disconnect', () => {
    const roomCode = getRoomCode(socket.id);
    if (roomCode) {
      roomService.leaveRoom(roomCode, socket.id);
      const peerList = roomService.getPeerList(roomCode);

      // Tell remaining peers who left and send updated list
      socket.to(roomCode).emit('peer-left', { peerId: socket.id });
      socket.to(roomCode).emit('peer-list-updated', { peerList });

      deleteRoomMapping(socket.id);
    }
  });
};

module.exports = registerRoomHandlers;
