const express = require('express');
const router = express.Router();
const { getBackendPublicKey, getFrontendPublicKey } = require('../controllers/keyExchangeController');

router.get('/public-key', getBackendPublicKey); // Get backend public key
router.get('/frontend-public-key', getFrontendPublicKey); // Get frontend public key

module.exports = router;