const express = require('express');
const router = express.Router();
const statusController = require('../controllers/statusController');

// Health Check Endpoint
router.get('/health', statusController.getHealthStatus);

module.exports = router;
