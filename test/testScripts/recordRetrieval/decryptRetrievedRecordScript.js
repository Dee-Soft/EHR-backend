const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Paths
const frontendPrivateKeyPath = path.join(__dirname, '../../frontendKeys/frontendTestPrivateKey.pem');
const encryptedRecordPath = path.join(__dirname, '../../data/encryptedRecord.json');

// Load frontend private key
const frontendPrivateKey = fs.readFileSync(frontendPrivateKeyPath, 'utf8');

// Decrypt AES key using frontend private key
function decryptAESKey(encryptedAESKey) {
  return crypto.privateDecrypt(
    {
      key: frontendPrivateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    Buffer.from(encryptedAESKey, 'base64')
  ).toString('hex'); // Return AES key as hex string
}

// Decrypt data fields using AES
function decryptWithAES(encryptedData, aesKey) {
  if (typeof encryptedData !== 'string' || !encryptedData.includes(':')) {
  throw new Error('Invalid encrypted field format');
}
  const [ivHex, encrypted] = encryptedData.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(aesKey, 'hex'), iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Main function
function decryptRecord(record) {
  const decryptedAESKey = decryptAESKey(record.encryptedAesKey);
  console.log('Decrypted AES key:', decryptedAESKey);

  const decryptField = (data) => {
    if (Array.isArray(data)) {
      return data.map((item) => decryptWithAES(item, decryptedAESKey));
    }
    if (typeof data === 'string') {
      return decryptWithAES(data, decryptedAESKey);
    }
    throw new Error('Unsupported encrypted field type');
  };

  const decryptedRecord = {
    _id: record._id,
    patient: record.patient,
    diagnosis: decryptField(record.diagnosis),
    notes: decryptField(record.notes),
    medications: JSON.parse(decryptField(record.medications)),
    visitDate: record.visitDate,
  };

  console.log('\nDecrypted Patient Record:');
  console.log(JSON.stringify(decryptedRecord, null, 2));
  return decryptedRecord;
}

// Load record from file
if (fs.existsSync(encryptedRecordPath)) {
  console.log('Loading encrypted record from file...');
  const jsonData = JSON.parse(fs.readFileSync(encryptedRecordPath, 'utf8'));
  const encryptedRecord = jsonData.record ?? jsonData;

  decryptRecord(encryptedRecord);
} else {
  console.error('Encrypted record file not found at', encryptedRecordPath);
}
