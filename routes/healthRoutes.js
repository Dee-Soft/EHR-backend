/**
 * Health Check Routes
 * Endpoints for system health monitoring
 */

const express = require('express');
const router = express.Router();
const { getHealth, getReadiness, getLiveness } = require('../controllers/healthController');

// @route   GET /api/health
// @desc    Get overall system health
// @access  Public
router.get('/', getHealth);

// @route   GET /api/health/ready
// @desc    Get readiness status (Kubernetes)
// @access  Public
router.get('/ready', getReadiness);

// @route   GET /api/health/live
// @desc    Get liveness status (Kubernetes)
// @access  Public
router.get('/live', getLiveness);

module.exports = router;

