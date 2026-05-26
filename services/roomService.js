const crypto = require('crypto');
const config = require('../config/env');

const PEER_COLORS = [
  '#566434', // green (brand secondary)
  '#875400', // amber (brand tertiary)
  '#4a7c9e', // blue
  '#7a3f6e', // purple
  '#c0392b', // red
  '#2c7a6b', // teal
  '#6b4c2a', // brown
  '#3d5a80'  // navy
];

class RoomService {
  constructor() {
    this.rooms = new Map();
    this.roomCodeLength = config.ROOM_CODE_LENGTH;
    this.maxRoomSize = config.MAX_ROOM_SIZE;
    this.roomMaxAgeMs = config.ROOM_MAX_AGE_MINUTES * 60 * 1000;

    // Sweeper sweeps rooms every 15 seconds to enforce 60s grace periods accurately
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredRooms();
    }, 15 * 1000);
  }

  cleanupExpiredRooms() {
    const now = Date.now();
    const cutoff = now - this.roomMaxAgeMs;
    for (const [code, room] of this.rooms.entries()) {
      const isEmpty = room.peers.size === 0;
      const emptyTooLong = isEmpty && room.emptyAt && (now - room.emptyAt > 60 * 1000);
      const tooOld = (room.createdAt < cutoff);
      if (emptyTooLong || tooOld) {
        this.rooms.delete(code);
      }
    }
  }

  generateRoomCode() {
    // Exclude ambiguous chars: 0/O, 1/I/L
    const charset = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let code = '';
    const randomBytes = crypto.randomBytes(this.roomCodeLength);
    for (let i = 0; i < this.roomCodeLength; i++) {
      code += charset[randomBytes[i] % charset.length];
    }
    return code.slice(0, 3) + '-' + code.slice(3);
  }

  createRoom(maxSize = config.MAX_ROOM_SIZE, allowLateJoinerFiles = false) {
    let roomCode = this.generateRoomCode();
    // Ensure uniqueness
    while (this.rooms.has(roomCode)) {
      roomCode = this.generateRoomCode();
    }

    this.rooms.set(roomCode, {
      peers: new Map(),
      maxSize: maxSize,
      createdAt: Date.now(),
      hostId: null,
      emptyAt: null,
      allowLateJoinerFiles,
      sharedFilesLog: []
    });

    return roomCode;
  }

  joinRoom(roomCode, peerId, name, isHost = false) {
    if (!this.rooms.has(roomCode)) {
      return { success: false, error: 'Room not found' };
    }

    const room = this.rooms.get(roomCode);
    if (room.peers.size >= room.maxSize && !room.peers.has(peerId)) {
      return { success: false, error: 'Room is full' };
    }

    let hostStatus = isHost;
    if (room.peers.size === 0) {
      room.hostId = peerId;
      hostStatus = true;
    }

    const color = PEER_COLORS[room.peers.size % PEER_COLORS.length];
    room.peers.set(peerId, { name, color, isHost: hostStatus, joinedAt: Date.now() });

    return { success: true, color };
  }

  leaveRoom(roomCode, peerId) {
    if (this.rooms.has(roomCode)) {
      const room = this.rooms.get(roomCode);
      room.peers.delete(peerId);

      // Grace period before empty room cleanup
      if (room.peers.size === 0) {
        room.emptyAt = Date.now();
        return true; 
      }
    }
    return false;
  }

  getPeerList(roomCode) {
    if (this.rooms.has(roomCode)) {
      const room = this.rooms.get(roomCode);
      const list = [];
      for (const [id, peer] of room.peers.entries()) {
        list.push({ peerId: id, name: peer.name, color: peer.color, isHost: peer.isHost, connected: true });
      }
      return list;
    }
    return [];
  }

  isHost(roomCode, peerId) {
    if (this.rooms.has(roomCode)) {
      return this.rooms.get(roomCode).hostId === peerId;
    }
    return false;
  }

  deleteRoom(roomCode) {
    if (this.rooms.has(roomCode)) {
      this.rooms.delete(roomCode);
      return true;
    }
    return false;
  }

  addFileLog(roomCode, fileEntry) {
    if (this.rooms.has(roomCode)) {
      const room = this.rooms.get(roomCode);
      if (room.allowLateJoinerFiles) {
        room.sharedFilesLog.push(fileEntry);
      }
    }
  }

  getRoomInfo(roomCode) {
    if (this.rooms.has(roomCode)) {
      const room = this.rooms.get(roomCode);
      return {
        allowLateJoinerFiles: room.allowLateJoinerFiles,
        sharedFilesLog: room.allowLateJoinerFiles ? room.sharedFilesLog : []
      };
    }
    return null;
  }

  peerDisconnected(peerId) {
    const emptyRooms = [];
    const roomsAffected = [];

    for (const [roomCode, room] of this.rooms.entries()) {
      if (room.peers.has(peerId)) {
        room.peers.delete(peerId);
        roomsAffected.push(roomCode);
        if (room.peers.size === 0) {
          emptyRooms.push(roomCode);
        }
      }
    }

    emptyRooms.forEach(roomCode => this.rooms.delete(roomCode));
    return roomsAffected;
  }
}

// Export singleton instance
const roomService = new RoomService();
module.exports = roomService;
