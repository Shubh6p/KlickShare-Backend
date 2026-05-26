const { ensureSameRoom } = require('./state');

const registerSignalHandlers = (io, socket) => {
  // WEBRTC SIGNALING: OFFER
  socket.on('signal-offer', (data) => {
    if (data && data.targetPeerId && ensureSameRoom(socket.id, data.targetPeerId)) {
      socket.to(data.targetPeerId).emit('signal-offer', {
        offer: data.offer,
        senderPeerId: socket.id
      });
    }
  });

  // WEBRTC SIGNALING: ANSWER
  socket.on('signal-answer', (data) => {
    if (data && data.targetPeerId && ensureSameRoom(socket.id, data.targetPeerId)) {
      socket.to(data.targetPeerId).emit('signal-answer', {
        answer: data.answer,
        senderPeerId: socket.id
      });
    }
  });

  // WEBRTC SIGNALING: ICE CANDIDATE
  socket.on('signal-ice-candidate', (data) => {
    if (data && data.targetPeerId && ensureSameRoom(socket.id, data.targetPeerId)) {
      socket.to(data.targetPeerId).emit('signal-ice-candidate', {
        candidate: data.candidate,
        senderPeerId: socket.id
      });
    }
  });
};

module.exports = registerSignalHandlers;
