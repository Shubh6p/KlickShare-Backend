/**
 * GET /health
 * Returns service availability and process uptime details.
 */
const getHealthStatus = (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  getHealthStatus
};
