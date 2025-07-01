const crypto = require('crypto');

// Generates a 256-bit AES key (32 bytes in hex)
function generateAESKey() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = {
  generateAESKey,
};
