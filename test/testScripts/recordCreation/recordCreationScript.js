const axios = require('axios');
const crypto = require('crypto');

// Backend API URL
const BACKEND_URL = 'http://localhost:3001';

// Simulated frontend RSA key pair
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

// AES encryption matching backend logic
function encryptWithAES(plainText, aesKey) {
  if (!plainText || !aesKey) throw new Error('Missing plainText or aesKey');
  const iv = crypto.randomBytes(16);
  const keyBuffer = Buffer.from(aesKey, 'hex');
  const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`; // Format expected by backend
}

// Encrypt AES key with backend public key
function encryptAESKeyWithBackendPublicKey(aesKey, backendPublicKey) {
  return crypto.publicEncrypt(
    {
      key: backendPublicKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    Buffer.from(aesKey, 'hex') // pass AES key as raw bytes, not UTF-8 string
  ).toString('base64');
}

async function main() {
  console.log('Fetching backend public key...');
  const backendPublicKey = await fetchBackendPublicKey();
  console.log('Backend public key retrieved.');

  // Step 1: Generate random AES key (256-bit)
  const aesKey = crypto.randomBytes(32).toString('hex');
  console.log('Generated frontend AES key:', aesKey);

  // Step 2: Encrypt sensitive fields with AES key
  const payload = {
    patient: '6863d3923b3b66d0520f2fbd', // example patient ObjectId
    diagnosis: encryptWithAES('Diabetes Type II', aesKey),
    notes: encryptWithAES('Patient shows signs of improvement.', aesKey),
    medications: encryptWithAES(JSON.stringify(['Metformin', 'Insulin']), aesKey),
    visitDate: new Date().toISOString().split('T')[0], // today
  };

  console.log('Encrypted payload:', payload);

  // Step 3: Encrypt AES key with backend public key
  const encryptedAESKey = encryptAESKeyWithBackendPublicKey(aesKey, backendPublicKey);
  console.log('Encrypted AES key:', encryptedAESKey);

  console.log('\nHeaders to use in Postman:');
  console.log(`x-encrypted-aes-key: ${encryptedAESKey}`);
  console.log(`x-client-public-key: ${frontendPublicKey}`);

  console.log('\nJSON body to use in Postman:');
  console.log(JSON.stringify(payload, null, 2));
}

main();