const { decryptWithBackendPrvKey } = require('../utils/rsaUtils');

module.exports = async function loadAESKey(req, res, next) {
  try {
    const encryptedAesKey = req.record?.encryptedAesKey || req.headers['x-encrypted-aes-key'];
    if (!encryptedAesKey) {
      return res.status(400).json({ message: 'Missing encrypted AES key in record or headers' });
    }

    const aesKey = decryptWithBackendPrvKey(encryptedAesKey);
    if (!aesKey) {
      return res.status(500).json({ message: 'Failed to decrypt AES key' });
    }

    req.aesKey = aesKey;
    next();
  } catch (error) {
    console.error('loadAESKey error:', error.message);
    res.status(500).json({ message: 'Failed to load AES key', error: error.message });
  }
};
