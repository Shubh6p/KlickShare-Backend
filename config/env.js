require('dotenv').config();

const allowedOrigins = process.env.CLIENT_URL 
  ? process.env.CLIENT_URL.split(',').map(url => url.trim()) 
  : ['https://klickshare-theta.vercel.app', 'http://localhost:5173'];

const config = {
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  CLIENT_URLS: allowedOrigins,
  MAX_CONNECTIONS_PER_MINUTE: parseInt(process.env.MAX_CONNECTIONS_PER_MINUTE, 10) || 20,
  ROOM_CODE_LENGTH: parseInt(process.env.ROOM_CODE_LENGTH, 10) || 6,
  MAX_ROOM_SIZE: parseInt(process.env.MAX_ROOM_SIZE, 10) || 2,
  ROOM_MAX_AGE_MINUTES: parseInt(process.env.ROOM_MAX_AGE_MINUTES, 10) || 30,
  
  // ICE / WebRTC Servers Configuration
  ICE_SERVERS: (() => {
    const defaultServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      { urls: 'stun:stun.services.mozilla.com' },
      // Public free TURN servers as a fallback for strict networks
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
    ];

    if (process.env.TURN_URL && process.env.TURN_USERNAME && process.env.TURN_PASSWORD) {
      return [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun.services.mozilla.com' },
        {
          urls: process.env.TURN_URL,
          username: process.env.TURN_USERNAME,
          credential: process.env.TURN_PASSWORD
        }
      ];
    }
    
    return defaultServers;
  })()
};

module.exports = config;
