/**
 * Test patient record fixtures
 */
const testRecords = {
  record1: {
    patient: null, // Will be set to actual patient ObjectId in tests
    diagnosis: 'Hypertension',
    notes: 'Patient showing good response to treatment',
    medications: JSON.stringify(['Lisinopril', 'Aspirin']),
    visitDate: new Date('2024-01-15'),
    createdBy: null, // Will be set to actual provider ObjectId in tests
    encryptedAesKey: 'vault:v1:mock-encrypted-aes-key-1',
    transitKeyVersion: 1,
    encryptionMetadata: {
      algorithm: 'aes256-gcm96',
      keyId: 'test-aes-key',
      encryptedAt: new Date('2024-01-15T10:30:00.000Z')
    }
  },
  
  record2: {
    patient: null,
    diagnosis: 'Type 2 Diabetes',
    notes: 'Regular monitoring required',
    medications: JSON.stringify(['Insulin', 'Metformin']),
    visitDate: new Date('2024-02-20'),
    createdBy: null,
    encryptedAesKey: 'vault:v1:mock-encrypted-aes-key-2',
    transitKeyVersion: 1,
    encryptionMetadata: {
      algorithm: 'aes256-gcm96',
      keyId: 'test-aes-key',
      encryptedAt: new Date('2024-02-20T14:45:00.000Z')
    }
  },
  
  record3: {
    patient: null,
    diagnosis: 'Seasonal Allergies',
    notes: 'Mild symptoms during spring season',
    medications: JSON.stringify(['Antihistamine']),
    visitDate: new Date('2024-03-10'),
    createdBy: null,
    encryptedAesKey: 'vault:v1:mock-encrypted-aes-key-3',
    transitKeyVersion: 1,
    encryptionMetadata: {
      algorithm: 'aes256-gcm96',
      keyId: 'test-aes-key',
      encryptedAt: new Date('2024-03-10T09:15:00.000Z')
    }
  },
};

/**
 * Invalid record data for testing validation
 */
const invalidRecords = {
  missingPatient: {
    diagnosis: 'Test Diagnosis',
    notes: 'Test Notes',
    medications: JSON.stringify(['Test Med']),
    visitDate: new Date(),
    createdBy: 'someId',
    encryptedAesKey: 'vault:v1:test-key',
  },
  
  missingDiagnosis: {
    patient: 'someId',
    notes: 'Test Notes',
    medications: JSON.stringify(['Test Med']),
    visitDate: new Date(),
    createdBy: 'someId',
    encryptedAesKey: 'vault:v1:test-key',
  },
  
  missingEncryptedAesKey: {
    patient: 'someId',
    diagnosis: 'Test Diagnosis',
    notes: 'Test Notes',
    medications: JSON.stringify(['Test Med']),
    visitDate: new Date(),
    createdBy: 'someId',
  },
};

/**
 * Encrypted record data samples for testing decryption
 */
const encryptedRecordSamples = {
  // These would contain actual encrypted data in real scenarios
  sampleEncrypted: {
    patient: null,
    diagnosis: 'vault:v1:encrypted-diagnosis',
    notes: 'vault:v1:encrypted-notes',
    medications: 'vault:v1:encrypted-medications',
    visitDate: new Date('2024-01-15'),
    createdBy: null,
    encryptedAesKey: 'vault:v1:encrypted-aes-key',
    transitKeyVersion: 1,
    encryptionMetadata: {
      algorithm: 'aes256-gcm96',
      keyId: 'test-aes-key',
      encryptedAt: new Date('2024-01-15T10:30:00.000Z')
    }
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
    keyId: 'test-aes-key',
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
      keyId: 'test-aes-key'
    }
  }
};

module.exports = {
  testRecords,
  invalidRecords,
  encryptedRecordSamples,
  openBaoTestData,
};
