const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Helper to read a key file safely
function readKey(filePath, keyName) {
    try {
        return fs.readFileSync(path.resolve(filePath), 'utf8');
    } catch (err) {
        console.error(`Failed to load ${keyName} from ${filePath}`);
        throw err;
    }
}

// Load paths from .env or use defaults
const backendPrivateKeyPath = process.env.BACKEND_PRIVATE_KEY_PATH || path.join(__dirname, 'keys', 'backendPrivateKey.pem');
const backendPublicKeyPath = process.env.BACKEND_PUBLIC_KEY_PATH || path.join(__dirname, 'keys', 'backendPublicKey.pem');
const frontendPublicKeyPath = process.env.FRONTEND_PUBLIC_KEY_PATH || path.join(__dirname, '../test/frontendKeys/frontendTestPublicKey.pem');

// Load keys
const backendPrivateKey = readKey(backendPrivateKeyPath, 'Backend Private Key');
const backendPublicKey = readKey(backendPublicKeyPath, 'Backend Public Key');
const frontendTestPublicKey = readKey(frontendPublicKeyPath, 'Frontend Test Public Key');

// Export keys
module.exports = {
    backendPrivateKey,
    backendPublicKey,
    frontendTestPublicKey,
};
