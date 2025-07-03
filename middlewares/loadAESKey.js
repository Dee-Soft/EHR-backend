const { decryptWithBackendPrvKey } = require('../utils/rsaUtils');

function loadAESKey(encryptedAesKey) {
    if (!encryptedAesKey) {
        throw new Error('Encrypted AES key is missing');
    }

    try {
        const aesKey = decryptWithBackendPrvKey(encryptedAesKey);
        if (!aesKey) {
            throw new Error('Decryption returned no key');
        }
        return aesKey;
    } catch (error) {
        console.error('loadAESKey error:', error.message);
        throw new Error('Failed to load AES key: ' + error.message);
    }
}

module.exports = { loadAESKey };
