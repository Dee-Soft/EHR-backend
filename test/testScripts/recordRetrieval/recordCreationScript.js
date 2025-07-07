const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Backend API URL
const BACKEND_URL = 'http://localhost:3001';

// Paths
const frontendPrivateKeyPath = path.join(__dirname, '../../frontendKeys/frontendTestPrivateKey.pem');
const recordPath = path.join(__dirname, '../../data/encryptedRecord.json');

// Generate frontend RSA key pair
const { publicKey: frontendPublicKey, privateKey: frontendPrivateKey } = crypto.generateKeyPairSync('rsa', {
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

// Save frontend private key
fs.mkdirSync(path.dirname(frontendPrivateKeyPath), { recursive: true });
fs.writeFileSync(frontendPrivateKeyPath, frontendPrivateKey, { mode: 0o600 });
console.log('Frontend private key saved to:', frontendPrivateKeyPath);

// Fetch backend public key
async function fetchBackendPublicKey() {
  try {
    const response = await axios.get(`${BACKEND_URL}/api/key-exchange/backend`);
    return response.data.publicKey;
  } catch (err) {
    console.error('Failed to fetch backend public key:', err.response?.data || err.message);
    process.exit(1);
  }
}

// Encrypt data with AES
function encryptWithAES(plainText, aesKey) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(aesKey, 'hex'), iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

// Encrypt AES key with backend public key for transit
function encryptAESKeyForTransit(aesKey, backendPublicKey) {
  return crypto.publicEncrypt(
    {
      key: backendPublicKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    Buffer.from(aesKey, 'hex') // Raw AES key
  ).toString('base64');
}

async function main() {
  console.log('Fetching backend public key...');
  const backendPublicKey = await fetchBackendPublicKey();
  console.log('Backend public key retrieved.');

  // Generate random AES key
  const aesKey = crypto.randomBytes(32).toString('hex');
  console.log('Generated frontend AES key:', aesKey);

  // Encrypt sensitive fields
  const payload = {
    patient: '6863d3923b3b66d0520f2fbd', // Replace with actual patient ID
    diagnosis: encryptWithAES('Asthma - mild intermittent', aesKey),
    notes: encryptWithAES('Monitor symptoms weekly and adjust medication if needed.', aesKey),
    medications: encryptWithAES(JSON.stringify(['Albuterol inhaler']), aesKey),
    visitDate: new Date().toISOString().split('T')[0],
  };

  console.log('Encrypted payload:', payload);

  // Encrypt AES key for backend (transit)
  const encryptedAESKeyForTransit = encryptAESKeyForTransit(aesKey, backendPublicKey);
  console.log('Encrypted AES key for backend (transit):', encryptedAESKeyForTransit);

  console.log('\nSending POST request to create record...');

  // Convert frontend public key to Base64 for header
  const frontendPublicKeyBase64 = Buffer.from(frontendPublicKey, 'utf8').toString('base64');

  async function loginAndGetToken() {
    const response = await axios.post(`${BACKEND_URL}/api/auth/login`, {
      email: 'sarah.patel@ehr.com',
      password: 'Strong@123',
    });
    return response.data.token;
  }

  // Login to get token
  console.log('Logging in to get token...');
  const token = await loginAndGetToken();
  console.log('Using token:', token);

  try {
    const response = await axios.post(
      `${BACKEND_URL}/api/patient-records/`,
      payload,
      {
        headers: {
          'x-encrypted-aes-key': encryptedAESKeyForTransit,
          'x-client-public-key': frontendPublicKeyBase64, // Send frontend public key
          Authorization: `Bearer ${token}`,
        }
      }
    );
    console.log('Record created successfully:', response.data);

    // Save encrypted record to file
    fs.mkdirSync(path.dirname(recordPath), { recursive: true });
    fs.writeFileSync(recordPath, JSON.stringify(response.data, null, 2), { mode: 0o600 });
    console.log(`Saved encrypted record to: ${recordPath}`);

    console.log('\nFrontend public key (for Postman GET calls):');
    console.log(frontendPublicKey);

    console.log('\nFrontend private key (for debugging):');
    console.log(frontendPrivateKey);

  } catch (err) {
    console.error('Failed to create record:', err.response?.data || err.message);
  }
}

main();
