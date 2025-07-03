const fs = require('fs');
const path = require('path');

// Backend Keys
const backendPrivateKeyPath = path.join(__dirname, 'keys', 'backendPrivateKey.pem');
const backendPublicKeyPath = path.join(__dirname, 'keys', 'backendPublicKey.pem');

// Frontend Test Keys (for testing only)
const frontendPublicKeyPath = path.join(__dirname, '../test/frontendKeys/frontendTestPublicKey.pem');

// Helper to read a key file safely
function readKey(filePath, keyName) {
    try {
        return fs.readFileSync(filePath, 'utf8');
    } catch (err) {
        console.error(`Failed to load ${keyName} from ${filePath}`);
        throw err;
    }
}

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