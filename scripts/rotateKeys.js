const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const keyDir = path.join(__dirname, '../config/keys');
const privateKeyPath = path.join(keyDir, 'backendPrivateKey.pem');
const publicKeyPath = path.join(keyDir, 'backendPublicKey.pem');

function rotateKeys() {
    try {
        console.log('Generating new RSA key pair (2048 bits)...');
        const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: {
                type: 'spki',
                format: 'pem',
            },
            privateKeyEncoding: {
                type: 'pkcs1',
                format: 'pem',
            },
        });

        if (!fs.existsSync(keyDir)) {
            fs.mkdirSync(keyDir, { recursive: true });
        }

        fs.writeFileSync(privateKeyPath, privateKey, { mode: 0o600 });
        fs.writeFileSync(publicKeyPath, publicKey, { mode: 0o600 });

        console.log(`✅ Keys rotated and saved:
  Private Key: ${privateKeyPath}
  Public Key:  ${publicKeyPath}`);
    } catch (err) {
        console.error('Error rotating keys:', err);
        process.exit(1);
    }
}

module.exports = rotateKeys;