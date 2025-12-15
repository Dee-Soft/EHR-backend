const axios = require('axios');
const logger = require('../config/logger');

/**
 * Middleware to fetch frontend public key by hitting the route
 */
const fetchFrontendPublicKey = async (req, res, next) => {
    try {
        await axios.get(`${process.env.BACKEND_URL}/api/key-exchange/backend`);
        logger.info('Fetched frontend public key via route');
        next();
    } catch (err) {
        logger.error('Failed to fetch frontend public key', { error: err.message });
        return res.status(500).json({ message: 'Failed to fetch frontend public key', error: err.message });
    }
};

/**
 * Middleware to send backend public key by hitting the route
 */
const sendBackendPublicKey = async (req, res, next) => {
    try {
        await axios.post(`${process.env.BACKEND_URL}/api/key-exchange/frontend`);
        logger.info('Sent backend public key via route');
        next();
    } catch (err) {
        logger.error('Failed to send backend public key', { error: err.message });
        return res.status(500).json({ message: 'Failed to send backend public key', error: err.message });
    }
};

module.exports = {
    fetchFrontendPublicKey,
    sendBackendPublicKey
};
// This middleware handles the key exchange process between the frontend and backend
// It fetches the frontend public key and sends the backend public key via HTTP requests