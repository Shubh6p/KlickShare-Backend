const crypto = require('crypto');
const PEER_COLORS = ['#566434'];

class RoomManager {
  constructor(roomCodeLength = 6, maxRoomSize = 2) {
    this.rooms = new Map();
    this.roomCodeLength = roomCodeLength;
    this.maxRoomSize = maxRoomSize;
  }

  generateRoomCode() {
    const charset = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let code = '';
    const randomBytes = crypto.randomBytes(this.roomCodeLength);
    for (let i = 0; i < this.roomCodeLength; i++) {
      code += charset[randomBytes[i] % charset.length];
    }
    return code.slice(0, 3) + '-' + code.slice(3);
  }

  createRoom(maxSize = 2) {
    let roomCode = this.generateRoomCode();
    this.rooms.set(roomCode, { peers: new Map(), maxSize: maxSize });
    return roomCode;
  }
  
  joinRoom(roomCode, peerId, name) {
    const room = this.rooms.get(roomCode);
    room.peers.set(peerId, { name, color: '#000' });
    return { success: true, color: '#000' };
  }
}

const rm = new RoomManager(parseInt(process.env.ROOM_CODE_LENGTH) || 6, 2);
const code = rm.createRoom(3);
console.log("Generated code:", code);
