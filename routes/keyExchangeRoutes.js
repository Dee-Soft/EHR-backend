const express = require('express');
const router = express.Router();
const { saveFrontendPublicKey, getBackendPublicKey } = require('../controllers/keyExchangeController');

router.post('/frontend', saveFrontendPublicKey); // Save frontend public key
router.get('/backend', getBackendPublicKey);     // Get backend public key

module.exports = router;