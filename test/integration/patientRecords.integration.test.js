/**
 * Patient Records Integration Tests
 * Tests record creation, retrieval, encryption, and access control
 */

const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../setup/testDb');
const { testUsers, plainPassword } = require('../setup/fixtures/users.fixture');
const User = require('../../models/User');
const PatientRecord = require('../../models/PatientRecord');
const crypto = require('crypto');

// Mock OpenBao
jest.mock('../../config/openbao.config', () => {
  const { createMockVaultClient } = require('../setup/mocks/openbaoMock');
  const mockVault = createMockVaultClient();
  return {
    getTransitClient: () => mockVault,
    keys: {
      aesMaster: 'ehr-aes-master',
      rsaExchange: 'ehr-rsa-exchange'
    },
    init: jest.fn().mockResolvedValue(true),
    initialized: true,
    healthCheck: jest.fn().mockResolvedValue({ healthy: true, initialized: true, sealed: false }),
    validateConnection: jest.fn().mockResolvedValue(true)
  };
});

// App will be imported inside beforeAll hook to ensure mocks are set up
let app;

// Helper function to extract cookie value from set-cookie header
const extractCookie = (setCookieHeader) => {
  if (!setCookieHeader) return null;
  const cookieString = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;
  // Extract just the name=value part before the first semicolon
  return cookieString.split(';')[0];
};

describe('Integration: Patient Records', () => {
  let adminToken, managerToken, providerToken, patientToken;
  let adminUser, managerUser, providerUser, patientUser, assignedPatientUser;

  beforeAll(async () => {
    await connect();
    // Import app after DB connection and mock setup
    app = require('../../server');
  });

  beforeEach(async () => {
    await clearDatabase();
    
    // Create users
    adminUser = await User.create(testUsers.admin);
    managerUser = await User.create(testUsers.manager);
    providerUser = await User.create(testUsers.provider);
    patientUser = await User.create(testUsers.patient);
    
    // Create assigned patient
    assignedPatientUser = await User.create({
      ...testUsers.patient,
      email: 'assigned@test.com',
      assignedProviderId: providerUser._id
    });

    // Update provider with assigned patient
    providerUser.assignedPatients.push(assignedPatientUser._id);
    await providerUser.save();

    // Get tokens
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: testUsers.admin.email, password: plainPassword });
    adminToken = extractCookie(adminLogin.headers['set-cookie']);

    const managerLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: testUsers.manager.email, password: plainPassword });
    managerToken = extractCookie(managerLogin.headers['set-cookie']);

    const providerLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: testUsers.provider.email, password: plainPassword });
    providerToken = extractCookie(providerLogin.headers['set-cookie']);

    const patientLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: assignedPatientUser.email, password: plainPassword });
    patientToken = extractCookie(patientLogin.headers['set-cookie']);
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe('POST /api/patient-records - Create Record', () => {
    // Helper to get today's date in local timezone (same as controller logic)
    const getTodayDate = () => {
      const today = new Date();
      const tzOffsetMs = today.getTimezoneOffset() * 60 * 1000;
      return new Date(today.getTime() - tzOffsetMs).toISOString().split('T')[0];
    };

    const getRecordData = () => ({
      diagnosis: 'Hypertension',
      notes: 'Patient stable, continue medication',
      medications: ['Lisinopril 10mg'],
      visitDate: getTodayDate()
    });

    const mockWrappedKey = 'vault:v1:' + crypto.randomBytes(32).toString('base64');
    const mockPublicKey = Buffer.from('mock-public-key').toString('base64');

    test('Provider can create record for assigned patient', async () => {
      const response = await request(app)
        .post('/api/patient-records')
        .set('Cookie', providerToken)
        .set('x-encrypted-aes-key', mockWrappedKey)
        .set('x-client-public-key', mockPublicKey)
        .send({
          ...getRecordData(),
          patient: assignedPatientUser._id
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Record created successfully');
      expect(response.body.record).toHaveProperty('diagnosis');
      expect(response.body.record.diagnosis).toMatch(/^vault:v\d+:/);
    });

    test('Provider cannot create record for unassigned patient', async () => {
      const response = await request(app)
        .post('/api/patient-records')
        .set('Cookie', providerToken)
        .set('x-encrypted-aes-key', mockWrappedKey)
        .set('x-client-public-key', mockPublicKey)
        .send({
          ...getRecordData(),
          patient: patientUser._id // Not assigned to this provider
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('assigned patients');
    });

    test('Manager can create record for any patient', async () => {
      const response = await request(app)
        .post('/api/patient-records')
        .set('Cookie', managerToken)
        .set('x-encrypted-aes-key', mockWrappedKey)
        .set('x-client-public-key', mockPublicKey)
        .send({
          ...getRecordData(),
          patient: patientUser._id
        });

      expect(response.status).toBe(201);
    });

    test('Patient cannot create records', async () => {
      const response = await request(app)
        .post('/api/patient-records')
        .set('Cookie', patientToken)
        .set('x-encrypted-aes-key', mockWrappedKey)
        .set('x-client-public-key', mockPublicKey)
        .send({
          ...getRecordData(),
          patient: assignedPatientUser._id
        });

      expect(response.status).toBe(403);
    });

    test('Should reject record with past visit date', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const tzOffsetMs = yesterday.getTimezoneOffset() * 60 * 1000;
      const pastDate = new Date(yesterday.getTime() - tzOffsetMs).toISOString().split('T')[0];

      const response = await request(app)
        .post('/api/patient-records')
        .set('Cookie', providerToken)
        .set('x-encrypted-aes-key', mockWrappedKey)
        .set('x-client-public-key', mockPublicKey)
        .send({
          ...getRecordData(),
          patient: assignedPatientUser._id,
          visitDate: pastDate
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('today');
    });

    test('Should reject record with missing required fields', async () => {
      const response = await request(app)
        .post('/api/patient-records')
        .set('Cookie', providerToken)
        .set('x-encrypted-aes-key', mockWrappedKey)
        .set('x-client-public-key', mockPublicKey)
        .send({
          patient: assignedPatientUser._id,
          diagnosis: 'Test'
          // Missing notes, medications, visitDate
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('required');
    });

    test('Created record should be encrypted', async () => {
      const response = await request(app)
        .post('/api/patient-records')
        .set('Cookie', providerToken)
        .set('x-encrypted-aes-key', mockWrappedKey)
        .set('x-client-public-key', mockPublicKey)
        .send({
          ...getRecordData(),
          patient: assignedPatientUser._id
        });

      expect(response.status).toBe(201);
      
      // Check that sensitive fields are encrypted (vault:v format)
      expect(response.body.record.diagnosis).toMatch(/^vault:v\d+:/);
      expect(response.body.record.notes).toMatch(/^vault:v\d+:/);
      expect(response.body.record.medications).toMatch(/^vault:v\d+:/);
      
      // Check that plaintext is not visible
      expect(response.body.record.diagnosis).not.toContain('Hypertension');
      expect(response.body.record.notes).not.toContain('stable');
    });
  });

  describe('GET /api/patient-records - Get All Records', () => {
    test('Manager can view all records', async () => {
      // Create some test records first
      await PatientRecord.create({
        patient: assignedPatientUser._id,
        diagnosis: 'vault:v1:encrypted',
        notes: 'vault:v1:encrypted',
        medications: 'vault:v1:encrypted',
        visitDate: new Date(),
        createdBy: providerUser._id,
        encryptedAesKey: 'vault:v1:key',
        transitKeyVersion: 1
      });

      const response = await request(app)
        .get('/api/patient-records')
        .set('Cookie', managerToken);

      expect(response.status).toBe(200);
      expect(response.body.records).toBeDefined();
      expect(Array.isArray(response.body.records)).toBe(true);
    });

    test('Provider cannot view all records', async () => {
      const response = await request(app)
        .get('/api/patient-records')
        .set('Cookie', providerToken);

      expect(response.status).toBe(403);
    });

    test('Patient cannot view all records', async () => {
      const response = await request(app)
        .get('/api/patient-records')
        .set('Cookie', patientToken);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/patient-records/my-records - Patient Own Records', () => {
    beforeEach(async () => {
      // Create record for assigned patient
      await PatientRecord.create({
        patient: assignedPatientUser._id,
        diagnosis: 'vault:v1:encrypted-diagnosis',
        notes: 'vault:v1:encrypted-notes',
        medications: 'vault:v1:encrypted-meds',
        visitDate: new Date(),
        createdBy: providerUser._id,
        encryptedAesKey: 'vault:v1:key',
        transitKeyVersion: 1
      });
    });

    test('Patient can view own records', async () => {
      const response = await request(app)
        .get('/api/patient-records/my-records')
        .set('Cookie', patientToken);

      expect(response.status).toBe(200);
      expect(response.body.records).toBeDefined();
      expect(response.body.records.length).toBeGreaterThan(0);
      expect(response.body.records[0].patient._id || response.body.records[0].patient).toEqual(assignedPatientUser._id.toString());
    });

    test('Patient only sees their own records', async () => {
      // Create record for another patient
      await PatientRecord.create({
        patient: patientUser._id,
        diagnosis: 'vault:v1:other',
        notes: 'vault:v1:other',
        medications: 'vault:v1:other',
        visitDate: new Date(),
        createdBy: providerUser._id,
        encryptedAesKey: 'vault:v1:key',
        transitKeyVersion: 1
      });

      const response = await request(app)
        .get('/api/patient-records/my-records')
        .set('Cookie', patientToken);

      expect(response.status).toBe(200);
      // Should only see own records, not other patient's
      response.body.records.forEach(record => {
        const recordPatientId = record.patient._id || record.patient;
        expect(recordPatientId.toString()).toBe(assignedPatientUser._id.toString());
      });
    });

    test('Non-patient cannot access my-records endpoint', async () => {
      const response = await request(app)
        .get('/api/patient-records/my-records')
        .set('Cookie', providerToken);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/patient-records/:id - Get Record by ID', () => {
    let testRecord;

    beforeEach(async () => {
      testRecord = await PatientRecord.create({
        patient: assignedPatientUser._id,
        diagnosis: 'vault:v1:encrypted',
        notes: 'vault:v1:encrypted',
        medications: 'vault:v1:encrypted',
        visitDate: new Date(),
        createdBy: providerUser._id,
        encryptedAesKey: 'vault:v1:key',
        transitKeyVersion: 1
      });
    });

    test('Provider can view assigned patient record', async () => {
      const response = await request(app)
        .get(`/api/patient-records/${testRecord._id}`)
        .set('Cookie', providerToken);

      expect(response.status).toBe(200);
      expect(response.body.record._id.toString()).toBe(testRecord._id.toString());
    });

    test('Patient can view own record', async () => {
      const response = await request(app)
        .get(`/api/patient-records/${testRecord._id}`)
        .set('Cookie', patientToken);

      expect(response.status).toBe(200);
      expect(response.body.record._id.toString()).toBe(testRecord._id.toString());
    });

    test('Manager can view any record', async () => {
      const response = await request(app)
        .get(`/api/patient-records/${testRecord._id}`)
        .set('Cookie', managerToken);

      expect(response.status).toBe(200);
      expect(response.body.record._id.toString()).toBe(testRecord._id.toString());
    });

    test('Provider cannot view unassigned patient record', async () => {
      const otherRecord = await PatientRecord.create({
        patient: patientUser._id, // Unassigned patient
        diagnosis: 'vault:v1:encrypted',
        notes: 'vault:v1:encrypted',
        medications: 'vault:v1:encrypted',
        visitDate: new Date(),
        createdBy: managerUser._id,
        encryptedAesKey: 'vault:v1:key',
        transitKeyVersion: 1
      });

      const response = await request(app)
        .get(`/api/patient-records/${otherRecord._id}`)
        .set('Cookie', providerToken);

      expect(response.status).toBe(403);
    });

    test('Should return 404 for non-existent record', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      
      const response = await request(app)
        .get(`/api/patient-records/${fakeId}`)
        .set('Cookie', managerToken);

      expect(response.status).toBe(404);
    });
  });

  describe('Encryption Integration', () => {
    // Helper to get today's date in local timezone (same as controller logic)
    const getTodayDate = () => {
      const today = new Date();
      const tzOffsetMs = today.getTimezoneOffset() * 60 * 1000;
      return new Date(today.getTime() - tzOffsetMs).toISOString().split('T')[0];
    };

    test('Record contains encrypted fields in vault format', async () => {
      const mockWrappedKey = 'vault:v1:' + crypto.randomBytes(32).toString('base64');
      const mockPublicKey = Buffer.from('mock-public-key').toString('base64');

      const response = await request(app)
        .post('/api/patient-records')
        .set('Cookie', providerToken)
        .set('x-encrypted-aes-key', mockWrappedKey)
        .set('x-client-public-key', mockPublicKey)
        .send({
          patient: assignedPatientUser._id,
          diagnosis: 'Type 2 Diabetes',
          notes: 'Blood sugar elevated',
          medications: ['Metformin 500mg'],
          visitDate: getTodayDate()
        });

      expect(response.status).toBe(201);
      
      // Verify OpenBao vault format
      expect(response.body.record.diagnosis).toMatch(/^vault:v\d+:/);
      expect(response.body.record.notes).toMatch(/^vault:v\d+:/);
      expect(response.body.record.medications).toMatch(/^vault:v\d+:/);
      
      // Verify key metadata
      expect(response.body.record.encryptedAesKey).toBeDefined();
      expect(response.body.record.transitKeyVersion).toBeDefined();
    });

    test('Record contains key version tracking', async () => {
      const record = await PatientRecord.create({
        patient: assignedPatientUser._id,
        diagnosis: 'vault:v1:encrypted',
        notes: 'vault:v1:encrypted',
        medications: 'vault:v1:encrypted',
        visitDate: new Date(),
        createdBy: providerUser._id,
        encryptedAesKey: 'vault:v1:key',
        transitKeyVersion: 1
      });

      expect(record.transitKeyVersion).toBe(1);
      expect(record.encryptedAesKey).toContain('vault:v');
    });
  });

  describe('Audit Logging', () => {
    // Helper to get today's date in local timezone (same as controller logic)
    const getTodayDate = () => {
      const today = new Date();
      const tzOffsetMs = today.getTimezoneOffset() * 60 * 1000;
      return new Date(today.getTime() - tzOffsetMs).toISOString().split('T')[0];
    };

    test('Record creation creates audit log', async () => {
      const AuditLog = require('../../models/AuditLog');
      
      const mockWrappedKey = 'vault:v1:' + crypto.randomBytes(32).toString('base64');
      const mockPublicKey = Buffer.from('mock-public-key').toString('base64');

      const response = await request(app)
        .post('/api/patient-records')
        .set('Cookie', providerToken)
        .set('x-encrypted-aes-key', mockWrappedKey)
        .set('x-client-public-key', mockPublicKey)
        .send({
          patient: assignedPatientUser._id,
          diagnosis: 'Test',
          notes: 'Test',
          medications: ['Test'],
          visitDate: getTodayDate()
        });

      // Verify record was created successfully
      expect(response.status).toBe(201);

      const auditLogs = await AuditLog.find({ action: 'CREATE_RECORD' });
      expect(auditLogs.length).toBeGreaterThan(0);
      expect(auditLogs[0].actorId.toString()).toBe(providerUser._id.toString());
    });

    test('Record retrieval creates audit log', async () => {
      const AuditLog = require('../../models/AuditLog');
      
      const record = await PatientRecord.create({
        patient: assignedPatientUser._id,
        diagnosis: 'vault:v1:encrypted',
        notes: 'vault:v1:encrypted',
        medications: 'vault:v1:encrypted',
        visitDate: new Date(),
        createdBy: providerUser._id,
        encryptedAesKey: 'vault:v1:key',
        transitKeyVersion: 1
      });

      const response = await request(app)
        .get(`/api/patient-records/${record._id}`)
        .set('Cookie', providerToken);

      // Verify record was retrieved successfully
      expect(response.status).toBe(200);

      const auditLogs = await AuditLog.find({ action: 'VIEW_RECORD' });
      expect(auditLogs.length).toBeGreaterThan(0);
    });
  });
});

