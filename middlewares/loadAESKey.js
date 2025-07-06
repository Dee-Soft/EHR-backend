const { decryptWithBackendPrvKey } = require('../utils/rsaUtils');

function loadAESKey(req, res, next) {
    try {
        const encryptedAesKey = req.headers['x-encrypted-aes-key'];
        if (!encryptedAesKey) {
            return res.status(400).json({ message: 'Missing encrypted AES key in headers' });
        }
        const aesKey = decryptWithBackendPrvKey(encryptedAesKey);

        console.log('Decrypted frontend AES key (hex):', aesKey);

        if (aesKey.length !== 64) {
            throw new Error(`Invalid AES key length: ${aesKey.length} hex chars`);
        }
        
        req.aesKey = aesKey;
        next();
    } catch (error) {
        console.error('Failed to load AES key:', error.message);
        return res.status(500).json({ message: 'Failed to load AES key', error: error.message });
    }
}

module.exports = { loadAESKey };
