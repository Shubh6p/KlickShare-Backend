const config = require('./env');

const isDev = config.NODE_ENV === 'development';

const corsOptions = {
  origin: (origin, callback) => {
    // In development, allow all origins for easy multi-device local network testing
    if (isDev || !origin || config.CLIENT_URLS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS blocked by Klicks policy'));
    }
  }
};

const socketCorsOptions = {
  origin: isDev ? '*' : config.CLIENT_URLS,
  methods: ['GET', 'POST']
};

module.exports = {
  corsOptions,
  socketCorsOptions
};
