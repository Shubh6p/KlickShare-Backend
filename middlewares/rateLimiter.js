const rateLimit = require('express-rate-limit');
const config = require('../config/env');

const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: config.MAX_CONNECTIONS_PER_MINUTE,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    message: 'Too many requests from this IP, please try again later.'
  }
});

module.exports = apiRateLimiter;
