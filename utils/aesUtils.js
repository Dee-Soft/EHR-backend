const crypto = require('crypto');

const algorithm = 'aes-256-cbc';

function encryptAES(data, key) {
    if (!data || typeof data !== 'string') {
        throw new Error('encryptAES expects a non-empty string as input');
    }
    if (!key) {
        throw new Error('encryptAES: AES key missing');
    }

    const aesKeyBuffer = Buffer.isBuffer(key) ? key : Buffer.from(key, 'hex');

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, aesKeyBuffer, iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

function decryptAES(data, key) {
    if (!data || typeof data !== 'string' || !data.includes(':')) {
        throw new Error('decryptAES expects data in "iv:encrypted" format');
    }
    if (!key) {
        throw new Error('decryptAES: AES key missing');
    }

    const [ivHex, encrypted] = data.split(':');
    if (!ivHex || !encrypted) {
        throw new Error('decryptAES: Invalid encrypted data format');
    }
    
    const aesKeyBuffer = Buffer.isBuffer(key) ? key : Buffer.from(key, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(algorithm, aesKeyBuffer, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

module.exports = { encryptAES, decryptAES };