const crypto = require('crypto');
const {
    backendPrivateKey,
    backendPublicKey,
    frontendTestPublicKey,
} = require('../config/keyManager');

// Encrypt AES key with backend's public key during record creation
function encryptWithBackendPubKey(aesKey) {
    return crypto.publicEncrypt(
        {
            key: backendPublicKey,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha256'
        },
        Buffer.from(aesKey, 'hex') // AES key should be passed as raw bytes, not UTF-8 string
    ).toString('base64');
}

// Decrypt AES key with backend's private key during record retrieval
function decryptWithBackendPrvKey(encryptedAesKey) {
    const buffer = Buffer.from(encryptedAesKey, 'base64');
    return crypto.privateDecrypt(
        {
            key: backendPrivateKey,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha256'
        },
        buffer
    ).toString('hex'); // Return AES key as hex string
}

// Re-encrypt AES key with frontend test public key before sending to client
function reEncryptWithFrontPubKey(newAesKey) {
    return crypto.publicEncrypt(
        {
            key: frontendTestPublicKey,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha256'
        },
        Buffer.from(newAesKey)
    ).toString('base64');
}

module.exports = {
    encryptWithBackendPubKey,
    decryptWithBackendPrvKey,
    reEncryptWithFrontPubKey
};
