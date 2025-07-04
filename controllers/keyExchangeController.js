const fs = require('fs');
const path = require('path');
const backendKeysDir = path.join(__dirname, '../config/keys');
const frontendKeyPath = path.join(backendKeysDir, 'frontendPublicKey.pem');
const backendPublicKeyPath = path.join(backendKeysDir, 'backendPublicKey.pem');

exports.saveFrontendPublicKey = (req, res) => {
    const { publicKey } = req.body;

    if (!publicKey || !publicKey.includes('BEGIN PUBLIC KEY')) {
        return res.status(400).json({ message: 'Invalid public key format' });
    }

    try {
        fs.writeFileSync(frontendKeyPath, publicKey, { mode: 0o600 });
        console.log(`[KeyExchange] Saved frontend public key to ${frontendKeyPath}`);
        res.status(200).json({ message: 'Frontend public key saved successfully' });
    } catch (err) {
        console.error(`[KeyExchange] Failed to save frontend public key:`, err);
        res.status(500).json({ message: 'Failed to save frontend public key', error: err.message });
    }
};

exports.getBackendPublicKey = (req, res) => {
    try {
        const backendPublicKey = fs.readFileSync(backendPublicKeyPath, 'utf8');
        res.status(200).json({ publicKey: backendPublicKey });
    } catch (err) {
        console.error(`[KeyExchange] Failed to load backend public key:`, err);
        res.status(500).json({ message: 'Failed to load backend public key', error: err.message });
    }
};