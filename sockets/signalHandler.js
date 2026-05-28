const { ensureSameRoom } = require('./state');

const registerSignalHandlers = (io, socket) => {
  // WEBRTC SIGNALING: OFFER
  socket.on('signal-offer', (data) => {
    if (data && data.targetPeerId) {
      if (ensureSameRoom(socket.id, data.targetPeerId)) {
        console.log(`[SIGNAL] Relaying OFFER from ${socket.id} to ${data.targetPeerId}`);
        socket.to(data.targetPeerId).emit('signal-offer', {
          offer: data.offer,
          senderPeerId: socket.id
        });
      } else {
        console.warn(`[SIGNAL BLOCKED] OFFER from ${socket.id} to ${data.targetPeerId} - Not in same room`);
      }
    }
  });

  // WEBRTC SIGNALING: ANSWER
  socket.on('signal-answer', (data) => {
    if (data && data.targetPeerId) {
      if (ensureSameRoom(socket.id, data.targetPeerId)) {
        console.log(`[SIGNAL] Relaying ANSWER from ${socket.id} to ${data.targetPeerId}`);
        socket.to(data.targetPeerId).emit('signal-answer', {
          answer: data.answer,
          senderPeerId: socket.id
        });
      } else {
        console.warn(`[SIGNAL BLOCKED] ANSWER from ${socket.id} to ${data.targetPeerId} - Not in same room`);
      }
    }
  });

  // WEBRTC SIGNALING: ICE CANDIDATE
  socket.on('signal-ice-candidate', (data) => {
    if (data && data.targetPeerId) {
      if (ensureSameRoom(socket.id, data.targetPeerId)) {
        // console.log(`[SIGNAL] Relaying ICE from ${socket.id} to ${data.targetPeerId}`); // Too noisy, commented out
        socket.to(data.targetPeerId).emit('signal-ice-candidate', {
          candidate: data.candidate,
          senderPeerId: socket.id
        });
      } else {
        console.warn(`[SIGNAL BLOCKED] ICE from ${socket.id} to ${data.targetPeerId} - Not in same room`);
      }
    }
  });
};

module.exports = registerSignalHandlers;
