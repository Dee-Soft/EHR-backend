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

module.exports = {
  testRecords,
  invalidRecords,
  encryptedRecordSamples,
};
