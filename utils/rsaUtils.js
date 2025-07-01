const crypto = require('crypto');
const { publicKey, privateKey } = require('../config/keyManager');

// Encrypt AES key with client's public RSA key (frontend sends this)
function encryptWithPublicKey(aesKey, clientPublicKey) {
  return crypto.publicEncrypt(
    {
      key: clientPublicKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    Buffer.from(aesKey)
  ).toString('base64');
}

// Decrypt AES key (if frontend ever sends one encrypted to backend)
function decryptWithPrivateKey(encryptedKeyBase64) {
  return crypto.privateDecrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    Buffer.from(encryptedKeyBase64, 'base64')
  ).toString('utf8');
}

module.exports = {
  encryptWithPublicKey,
  decryptWithPrivateKey,
};
