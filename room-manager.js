/**
 * @deprecated This file is deprecated and has been moved to services/roomService.js.
 * This wrapper is maintained for backwards compatibility with legacy imports/scripts.
 */
console.warn('[Deprecation Warning] room-manager.js is deprecated. Please use services/roomService.js instead.');

const roomService = require('./services/roomService');

// Export the underlying class constructor to maintain API compatibility
module.exports = roomService.constructor;
