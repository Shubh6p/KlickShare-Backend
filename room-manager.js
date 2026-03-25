const crypto = require('crypto');

class RoomManager {
  constructor(roomCodeLength = 6, maxRoomSize = 2) {
    this.rooms = new Map();
    this.roomCodeLength = roomCodeLength;
    this.maxRoomSize = maxRoomSize;
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

  createRoom() {
    let roomCode = this.generateRoomCode();
    // Ensure uniqueness
    while (this.rooms.has(roomCode)) {
      roomCode = this.generateRoomCode();
    }

    this.rooms.set(roomCode, {
      peers: new Set(),
      createdAt: Date.now()
    });

    return roomCode;
  }

  joinRoom(roomCode, peerId) {
    if (!this.rooms.has(roomCode)) {
      return { success: false, error: 'Room not found' };
    }

    const room = this.rooms.get(roomCode);
    if (room.peers.size >= this.maxRoomSize && !room.peers.has(peerId)) {
      return { success: false, error: 'Room is full' };
    }

    room.peers.add(peerId);
    return { success: true };
  }

  leaveRoom(roomCode, peerId) {
    if (this.rooms.has(roomCode)) {
      const room = this.rooms.get(roomCode);
      room.peers.delete(peerId);

      // Clean up empty rooms
      if (room.peers.size === 0) {
        this.rooms.delete(roomCode);
        return true; // Room was deleted
      }
    }
    return false;
  }

  getRoomPeers(roomCode) {
    if (this.rooms.has(roomCode)) {
      return Array.from(this.rooms.get(roomCode).peers);
    }
    return [];
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

module.exports = RoomManager;
