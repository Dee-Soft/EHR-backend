const crypto = require('crypto');

const algorithm = 'aes-256-cbc';

function encryptAES(data, key) {
    if (!data || typeof data !== 'string') {
        throw new Error('encryptAES expects a non-empty string as input');
    }
    if (!key || typeof key !== 'string') {
    throw new Error('encryptAES: AES key missing or invalid');
}

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, Buffer.from(key, 'hex'), iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

function decryptAES(data, key) {
    const [ivHex, encrypted] = data.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(algorithm, Buffer.from(key, 'hex'), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

module.exports = { encryptAES, decryptAES };