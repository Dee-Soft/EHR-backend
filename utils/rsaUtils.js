const crypto = require('crypto');

//generate RSA key pair
function generateRSAKeyPair() {
    return crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
        },
        privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem'
        }
    });
};

// Encrypt AES key with RSA public key
function encryptWithPublicKey(aesKey, publicKey) {
    const buffer = Buffer.from(aesKey);
    return crypto.publicEncrypt(publicKey, buffer).toString('base64');
}

// Decrypt AES key with RSA private key
function decryptWithPrivateKey(encryptedKey, privateKey) {
    const buffer = Buffer.from(encryptedKey, 'base64');
    return crypto.privateDecrypt(privateKey, buffer).toString();
}

module.exports = { generateRSAKeyPair, encryptWithPublicKey, decryptWithPrivateKey };