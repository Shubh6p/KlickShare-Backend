const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');

const config = require('./config/env');
const { corsOptions, socketCorsOptions } = require('./config/cors');
const apiRateLimiter = require('./middlewares/rateLimiter');
const apiRoutes = require('./routes');
const initSockets = require('./sockets');

const app = express();
const server = http.createServer(app);

// Apply Security Middlewares
app.use(helmet());
app.use(cors(corsOptions));
app.use(apiRateLimiter);

// Parse request bodies if needed (Express default)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Load HTTP Routes
app.use('/', apiRoutes);

// Serve React production build static assets in production mode if it exists
if (config.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../client-react/dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    
    // Fallback to React index.html for SPA page routings
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/socket.io') || req.path.startsWith('/health')) {
        return next();
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    console.log("React production build directory not found. Server running in API-only mode.");
  }
}

// Initialize Socket.io Server with restricted CORS
const io = new Server(server, {
  cors: socketCorsOptions
});

// Register socket controllers & events
initSockets(io);

// Start listening for connections
server.listen(config.PORT, () => {
  console.log(`+===========================================+`);
  console.log(`|        Klicks Server Started              |`);
  console.log(`|===========================================|`);
  console.log(`|  Port:     ${config.PORT}                       |`);
  console.log(`|  Mode:     ${config.NODE_ENV}               |`);
  console.log(`+===========================================+`);
});
