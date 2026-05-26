// In-memory application state tracking for socket -> room mapping
const peerToRoomMap = new Map();

/**
 * Get Room Code for a given socket ID
 */
const getRoomCode = (socketId) => {
  return peerToRoomMap.get(socketId);
};

/**
 * Map socket ID to Room Code
 */
const setRoomCode = (socketId, roomCode) => {
  peerToRoomMap.set(socketId, roomCode);
};

/**
 * Delete mapping for socket ID
 */
const deleteRoomMapping = (socketId) => {
  peerToRoomMap.delete(socketId);
};

/**
 * Verifies that the sender and target sockets reside in the exact same room
 */
const ensureSameRoom = (senderId, targetId) => {
  const roomA = peerToRoomMap.get(senderId);
  const roomB = peerToRoomMap.get(targetId);
  return !!(roomA && roomB && roomA === roomB);
};

module.exports = {
  peerToRoomMap,
  getRoomCode,
  setRoomCode,
  deleteRoomMapping,
  ensureSameRoom
};
