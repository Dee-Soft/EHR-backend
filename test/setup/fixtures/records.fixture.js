/**
 * Test patient record fixtures
 */
const testRecords = {
  record1: {
    patientId: null, // Will be set to actual patient ObjectId in tests
    diagnosis: 'Hypertension',
    treatment: 'Prescribed medication and lifestyle changes',
    notes: 'Patient showing good response to treatment',
    providerId: null, // Will be set to actual provider ObjectId in tests
  },
  
  record2: {
    patientId: null,
    diagnosis: 'Type 2 Diabetes',
    treatment: 'Insulin therapy and dietary management',
    notes: 'Regular monitoring required',
    providerId: null,
  },
  
  record3: {
    patientId: null,
    diagnosis: 'Seasonal Allergies',
    treatment: 'Antihistamines as needed',
    notes: 'Mild symptoms during spring season',
    providerId: null,
  },
};

/**
 * Invalid record data for testing validation
 */
const invalidRecords = {
  missingPatientId: {
    diagnosis: 'Test Diagnosis',
    treatment: 'Test Treatment',
    notes: 'Test Notes',
  },
  
  missingDiagnosis: {
    patientId: 'someId',
    treatment: 'Test Treatment',
    notes: 'Test Notes',
  },
};

/**
 * Encrypted record data samples for testing decryption
 */
const encryptedRecordSamples = {
  // These would contain actual encrypted data in real scenarios
  sampleEncrypted: {
    patientId: null,
    diagnosis: 'iv:encrypted', // Format: iv:encryptedData
    treatment: 'iv:encrypted',
    notes: 'iv:encrypted',
    providerId: null,
  },
};

/**
 * OpenBao-specific test data for encryption/decryption
 */
const openBaoTestData = {
  // Mock encrypted ciphertext in OpenBao format (vault:v{version}:{base64_ciphertext})
  mockEncryptedDiagnosis: 'vault:v1:8J+YguKdjO+7vcO3w7Y8Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8=',
  mockEncryptedNotes: 'vault:v1:4oCcUGF0aWVudCBzaG93cyBzaWducyBvZiBpbXByb3ZlbWVudOKAnQ==',
  mockEncryptedMedications: 'vault:v1:WyJJYnVwcm9mZW4iLCAiQW1veGljaWxsaW4iXQ==',
  
  // Mock data keys (base64 encoded 256-bit keys)
  mockPlaintextKey: 'dGVzdC1rZXktMzItYnl0ZXMtbG9uZy1mb3ItYWVzLTI1Ng==',
  mockCiphertextKey: 'vault:v1:Y2lwaGVydGV4dC1kYXRhLWtleS1lbmNyeXB0ZWQtYnktbWFzdGVyLWtleQ==',
  
  // Mock RSA wrapped keys
  mockWrappedAESKey: 'vault:v1:cnNhLXdyYXBwZWQtYWVzLWtleS1mb3ItZnJvbnRlbmQtZXhjaGFuZ2U=',
  
  // Key version metadata
  mockKeyVersion: 1,
  mockKeyId: 'data-key-1234567890-abc123',
  
  // Mock encryption metadata
  mockEncryptionMetadata: {
    algorithm: 'aes256-gcm96',
    keyId: 'ehr-aes-master',
    keyVersion: 1,
    encryptedAt: new Date('2024-01-01T00:00:00.000Z').toISOString()
  },
  
  // Sample encrypted record with OpenBao format
  sampleOpenBaoRecord: {
    patientId: null, // Will be set in tests
    diagnosis: 'vault:v1:8J+YguKdjO+7vcO3w7Y8Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8=',
    notes: 'vault:v1:4oCcUGF0aWVudCBzaG93cyBzaWducyBvZiBpbXByb3ZlbWVudOKAnQ==',
    medications: 'vault:v1:WyJJYnVwcm9mZW4iLCAiQW1veGljaWxsaW4iXQ==',
    visitDate: new Date('2024-01-15'),
    createdBy: null, // Will be set in tests
    encryptedAesKey: 'vault:v1:Y2lwaGVydGV4dC1kYXRhLWtleS1lbmNyeXB0ZWQtYnktbWFzdGVyLWtleQ==',
    transitKeyVersion: 1,
    encryptionMetadata: {
      algorithm: 'aes256-gcm96',
      keyId: 'ehr-aes-master'
    }
  }
};

module.exports = {
  testRecords,
  invalidRecords,
  encryptedRecordSamples,
  openBaoTestData,
};
