const crypto = require('crypto');
const { privateKey, publicKey } = require('../config/keyManager');

// Encrypt AES key with provided public key (frontend or backend)
function encryptWithPublicKey(aesKey, customPublicKey = publicKey) {
  return crypto.publicEncrypt(
    {
      key: customPublicKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    Buffer.from(aesKey)
  ).toString('base64');
}

// Decrypt AES key with provided private key (defaults to backend)
function decryptWithPrivateKey(encryptedBase64, customPrivateKey = privateKey) {
  return crypto.privateDecrypt(
    {
      key: customPrivateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    Buffer.from(encryptedBase64, 'base64')
  ).toString('utf8');
}

module.exports = {
  encryptWithPublicKey,
  decryptWithPrivateKey,
};
