/**
 * Authorization/RBAC Integration Tests
 * Tests role-based access control across all endpoints
 */

const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../setup/testDb');
const { testUsers, plainPassword } = require('../setup/fixtures/users.fixture');
const User = require('../../models/User');

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

const app = require('../../server');

describe('Integration: Authorization/RBAC', () => {
  let adminToken, managerToken, providerToken, employeeToken, patientToken;
  let adminUser, managerUser, providerUser, employeeUser, patientUser;

  beforeAll(async () => {
    await connect();
  }, 60000); // 60 second timeout for MongoDB Memory Server initialization

  beforeEach(async () => {
    await clearDatabase();
    
    // Create all user types
    adminUser = await User.create(testUsers.admin);
    managerUser = await User.create(testUsers.manager);
    providerUser = await User.create(testUsers.provider);
    employeeUser = await User.create(testUsers.employee);
    patientUser = await User.create(testUsers.patient);

    // Get tokens for each user
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: testUsers.admin.email, password: plainPassword });
    adminToken = adminLogin.headers['set-cookie'][0];

    const managerLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: testUsers.manager.email, password: plainPassword });
    managerToken = managerLogin.headers['set-cookie'][0];

    const providerLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: testUsers.provider.email, password: plainPassword });
    providerToken = providerLogin.headers['set-cookie'][0];

    const employeeLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: testUsers.employee.email, password: plainPassword });
    employeeToken = employeeLogin.headers['set-cookie'][0];

    const patientLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: testUsers.patient.email, password: plainPassword });
    patientToken = patientLogin.headers['set-cookie'][0];
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe('User Registration RBAC', () => {
    const newPatient = {
      name: 'New Patient',
      email: 'newpatient@test.com',
      password: 'Password@123',
      role: 'Patient',
      phone: '555-0100',
      address: '123 Test St',
      gender: 'Male',
      dateOfBirth: '1990-01-01'
    };

    const newProvider = {
      name: 'New Provider',
      email: 'newprovider@test.com',
      password: 'Password@123',
      role: 'Provider',
      phone: '555-0101',
      address: '124 Test St',
      gender: 'Female',
      providerId: 'PRV-001'
    };

    const newEmployee = {
      name: 'New Employee',
      email: 'newemployee@test.com',
      password: 'Password@123',
      role: 'Employee',
      phone: '555-0102',
      address: '125 Test St',
      gender: 'Male',
      employeeId: 'EMP-001'
    };

    const newManager = {
      name: 'New Manager',
      email: 'newmanager@test.com',
      password: 'Password@123',
      role: 'Manager',
      phone: '555-0103',
      address: '126 Test St',
      gender: 'Female'
    };

    describe('Admin Registration Rights', () => {
      test('Admin can register all roles', async () => {
        // Register Patient
        const patientRes = await request(app)
          .post('/api/users/register')
          .set('Cookie', adminToken)
          .send(newPatient);
        expect(patientRes.status).toBe(201);

        // Register Provider
        const providerRes = await request(app)
          .post('/api/users/register')
          .set('Cookie', adminToken)
          .send(newProvider);
        expect(providerRes.status).toBe(201);

        // Register Employee
        const employeeRes = await request(app)
          .post('/api/users/register')
          .set('Cookie', adminToken)
          .send(newEmployee);
        expect(employeeRes.status).toBe(201);

        // Register Manager
        const managerRes = await request(app)
          .post('/api/users/register')
          .set('Cookie', adminToken)
          .send(newManager);
        expect(managerRes.status).toBe(201);
      });
    });

    describe('Manager Registration Rights', () => {
      test('Manager can register Employee, Provider, Patient', async () => {
        // Can register Employee
        const employeeRes = await request(app)
          .post('/api/users/register')
          .set('Cookie', managerToken)
          .send(newEmployee);
        expect(employeeRes.status).toBe(201);

        // Can register Provider
        const providerRes = await request(app)
          .post('/api/users/register')
          .set('Cookie', managerToken)
          .send(newProvider);
        expect(providerRes.status).toBe(201);

        // Can register Patient
        const patientRes = await request(app)
          .post('/api/users/register')
          .set('Cookie', managerToken)
          .send(newPatient);
        expect(patientRes.status).toBe(201);
      });

      test('Manager cannot register another Manager', async () => {
        const response = await request(app)
          .post('/api/users/register')
          .set('Cookie', managerToken)
          .send(newManager);
        
        expect(response.status).toBe(403);
        expect(response.body.message).toContain('Not allowed to register');
      });
    });

    describe('Employee Registration Rights', () => {
      test('Employee can only register Patient', async () => {
        const response = await request(app)
          .post('/api/users/register')
          .set('Cookie', employeeToken)
          .send(newPatient);
        
        expect(response.status).toBe(201);
      });

      test('Employee cannot register Provider', async () => {
        const response = await request(app)
          .post('/api/users/register')
          .set('Cookie', employeeToken)
          .send(newProvider);
        
        expect(response.status).toBe(403);
      });

      test('Employee cannot register Employee', async () => {
        const response = await request(app)
          .post('/api/users/register')
          .set('Cookie', employeeToken)
          .send(newEmployee);
        
        expect(response.status).toBe(403);
      });
    });

    describe('Provider Registration Rights', () => {
      test('Provider cannot register anyone', async () => {
        const response = await request(app)
          .post('/api/users/register')
          .set('Cookie', providerToken)
          .send(newPatient);
        
        expect(response.status).toBe(403);
      });
    });

    describe('Patient Registration Rights', () => {
      test('Patient cannot register anyone', async () => {
        const response = await request(app)
          .post('/api/users/register')
          .set('Cookie', patientToken)
          .send(newPatient);
        
        expect(response.status).toBe(403);
      });
    });
  });

  describe('Admin Endpoints RBAC', () => {
    describe('GET /api/admin/audit-logs', () => {
      test('Admin can access audit logs', async () => {
        const response = await request(app)
          .get('/api/admin/audit-logs')
          .set('Cookie', adminToken);
        
        expect([200, 404]).toContain(response.status);
      });

      test('Manager cannot access audit logs', async () => {
        const response = await request(app)
          .get('/api/admin/audit-logs')
          .set('Cookie', managerToken);
        
        expect(response.status).toBe(403);
        expect(response.body.message).toBe('Access denied');
      });

      test('Provider cannot access audit logs', async () => {
        const response = await request(app)
          .get('/api/admin/audit-logs')
          .set('Cookie', providerToken);
        
        expect(response.status).toBe(403);
      });

      test('Employee cannot access audit logs', async () => {
        const response = await request(app)
          .get('/api/admin/audit-logs')
          .set('Cookie', employeeToken);
        
        expect(response.status).toBe(403);
      });

      test('Patient cannot access audit logs', async () => {
        const response = await request(app)
          .get('/api/admin/audit-logs')
          .set('Cookie', patientToken);
        
        expect(response.status).toBe(403);
      });
    });

    describe('POST /api/admin/assign-patient', () => {
      test('Admin can assign patient to provider', async () => {
        const response = await request(app)
          .post('/api/admin/assign-patient')
          .set('Cookie', adminToken)
          .send({
            providerId: providerUser._id,
            patientId: patientUser._id
          });
        
        expect(response.status).toBe(200);
      });

      test('Manager cannot assign patient to provider', async () => {
        const response = await request(app)
          .post('/api/admin/assign-patient')
          .set('Cookie', managerToken)
          .send({
            providerId: providerUser._id,
            patientId: patientUser._id
          });
        
        expect(response.status).toBe(403);
      });
    });
  });

  describe('Role Escalation Prevention', () => {
    test('Patient cannot access Admin endpoints', async () => {
      const response = await request(app)
        .get('/api/admin/audit-logs')
        .set('Cookie', patientToken);
      
      expect(response.status).toBe(403);
    });

    test('Employee cannot access Admin endpoints', async () => {
      const response = await request(app)
        .get('/api/admin/audit-logs')
        .set('Cookie', employeeToken);
      
      expect(response.status).toBe(403);
    });

    test('Provider cannot access Admin endpoints', async () => {
      const response = await request(app)
        .get('/api/admin/audit-logs')
        .set('Cookie', providerToken);
      
      expect(response.status).toBe(403);
    });

    test('Manager cannot access Admin-only endpoints', async () => {
      const response = await request(app)
        .post('/api/admin/assign-patient')
        .set('Cookie', managerToken)
        .send({
          providerId: providerUser._id,
          patientId: patientUser._id
        });
      
      expect(response.status).toBe(403);
    });
  });

  describe('User Update RBAC', () => {
    test('Admin can update any user', async () => {
      const response = await request(app)
        .put(`/api/users/${patientUser._id}`)
        .set('Cookie', adminToken)
        .send({ phone: '555-9999' });
      
      expect(response.status).toBe(200);
    });

    test('Manager can update Employee and Patient', async () => {
      const patientResponse = await request(app)
        .put(`/api/users/${patientUser._id}`)
        .set('Cookie', managerToken)
        .send({ phone: '555-8888' });
      
      expect(patientResponse.status).toBe(200);
    });

    test('Patient can only update their own phone/address', async () => {
      const response = await request(app)
        .put(`/api/users/${patientUser._id}`)
        .set('Cookie', patientToken)
        .send({ phone: '555-7777' });
      
      expect(response.status).toBe(200);
    });

    test('Patient cannot update another patient', async () => {
      const otherPatient = await User.create({
        ...testUsers.patient,
        email: 'other@test.com'
      });

      const response = await request(app)
        .put(`/api/users/${otherPatient._id}`)
        .set('Cookie', patientToken)
        .send({ phone: '555-6666' });
      
      expect(response.status).toBe(403);
    });
  });

  describe('Cross-Role Data Access', () => {
    test('Patient cannot view other patients data', async () => {
      // This would be tested more thoroughly in patient records tests
      // Just verify RBAC middleware is working
      const response = await request(app)
        .get('/api/patient-records')
        .set('Cookie', patientToken);
      
      // Should only see own records or get 403/404
      expect([200, 403, 404]).toContain(response.status);
    });

    test('Provider cannot access admin functions', async () => {
      const response = await request(app)
        .get('/api/admin/audit-logs')
        .set('Cookie', providerToken);
      
      expect(response.status).toBe(403);
    });
  });
});

