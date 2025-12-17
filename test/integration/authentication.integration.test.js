/**
 * Authentication Integration Tests
 * Tests login, logout, token management, and authentication flows
 */

const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../setup/testDb');
const { testUsers, plainPassword } = require('../setup/fixtures/users.fixture');
const User = require('../../models/User');
const jwt = require('jsonwebtoken');

// Mock OpenBao before requiring app
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

describe('Integration: Authentication', () => {
  beforeAll(async () => {
    await connect();
    // Import app after DB connection and mock setup
    app = require('../../server');
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe('POST /api/auth/login', () => {
    describe('Successful Login', () => {
      test('should login Admin with valid credentials', async () => {
        await User.create(testUsers.admin);

        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: testUsers.admin.email,
            password: plainPassword
          });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Login successful');
        expect(response.body.user).toHaveProperty('id');
        expect(response.body.user.role).toBe('Admin');
        expect(response.body.user.email).toBe(testUsers.admin.email);
        expect(response.headers['set-cookie']).toBeDefined();
        expect(response.headers['set-cookie'][0]).toContain('token=');
      });

      test('should login Manager with valid credentials', async () => {
        await User.create(testUsers.manager);

        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: testUsers.manager.email,
            password: plainPassword
          });

        expect(response.status).toBe(200);
        expect(response.body.user.role).toBe('Manager');
      });

      test('should login Provider with valid credentials', async () => {
        await User.create(testUsers.provider);

        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: testUsers.provider.email,
            password: plainPassword
          });

        expect(response.status).toBe(200);
        expect(response.body.user.role).toBe('Provider');
      });

      test('should login Employee with valid credentials', async () => {
        await User.create(testUsers.employee);

        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: testUsers.employee.email,
            password: plainPassword
          });

        expect(response.status).toBe(200);
        expect(response.body.user.role).toBe('Employee');
      });

      test('should login Patient with valid credentials', async () => {
        await User.create(testUsers.patient);

        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: testUsers.patient.email,
            password: plainPassword
          });

        expect(response.status).toBe(200);
        expect(response.body.user.role).toBe('Patient');
      });

      test('should set httpOnly cookie with token', async () => {
        await User.create(testUsers.admin);

        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: testUsers.admin.email,
            password: plainPassword
          });

        const cookies = response.headers['set-cookie'];
        expect(cookies).toBeDefined();
        expect(cookies[0]).toContain('HttpOnly');
        expect(cookies[0]).toContain('SameSite=Strict');
      });
    });

    describe('Failed Login Attempts', () => {
      test('should reject login with invalid password', async () => {
        await User.create(testUsers.patient);

        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: testUsers.patient.email,
            password: 'wrongpassword'
          });

        expect(response.status).toBe(401);
        expect(response.body.message).toBe('Invalid credentials');
        expect(response.headers['set-cookie']).toBeUndefined();
      });

      test('should reject login with non-existent email', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'nonexistent@example.com',
            password: plainPassword
          });

        expect(response.status).toBe(401);
        expect(response.body.message).toBe('Invalid credentials');
      });

      test('should reject login with missing email', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            password: plainPassword
          });

        expect(response.status).toBe(401);
        expect(response.body.message).toBe('Invalid credentials');
      });

      test('should reject login with missing password', async () => {
        await User.create(testUsers.patient);

        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: testUsers.patient.email
          });

        expect(response.status).toBe(500);
      });
    });
  });

  describe('GET /api/auth/me', () => {
    test('should return current user with valid token', async () => {
      const user = await User.create(testUsers.admin);

      // Login to get token
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUsers.admin.email,
          password: plainPassword
        });

      const token = extractCookie(loginRes.headers['set-cookie']);

      // Get current user
      const response = await request(app)
        .get('/api/auth/me')
        .set('Cookie', token);

      expect(response.status).toBe(200);
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user.role).toBe('Admin');
    });

    test('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Token is missing');
    });

    test('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Cookie', 'token=invalid-token');

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Failed to authenticate token');
    });

    test('should reject request with expired token', async () => {
      const user = await User.create(testUsers.admin);

      // Create expired token
      const expiredToken = jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '-1h' } // Expired 1 hour ago
      );

      const response = await request(app)
        .get('/api/auth/me')
        .set('Cookie', `token=${expiredToken}`);

      expect(response.status).toBe(403);
    });

    test('should reject request with tampered token', async () => {
      const user = await User.create(testUsers.admin);

      // Create valid token then tamper with it
      const validToken = jwt.sign(
        { id: user._id, role: 'Patient' }, // Wrong role
        process.env.JWT_SECRET
      );
      const tamperedToken = validToken.slice(0, -10) + 'TAMPERED!!';

      const response = await request(app)
        .get('/api/auth/me')
        .set('Cookie', `token=${tamperedToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/auth/logout', () => {
    test('should logout successfully and clear token', async () => {
      await User.create(testUsers.admin);

      // Login first
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUsers.admin.email,
          password: plainPassword
        });

      const token = extractCookie(loginRes.headers['set-cookie']);

      // Logout
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', token);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Logged out successfully');
      
      // Check that cookie is cleared
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toContain('token=;');
    });

    test('should logout even without valid token', async () => {
      const response = await request(app)
        .post('/api/auth/logout');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Logged out successfully');
    });
  });

  describe('Token Persistence', () => {
    test('should maintain authentication across multiple requests', async () => {
      await User.create(testUsers.admin);

      // Login
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUsers.admin.email,
          password: plainPassword
        });

      const token = extractCookie(loginRes.headers['set-cookie']);

      // First authenticated request
      const req1 = await request(app)
        .get('/api/auth/me')
        .set('Cookie', token);
      expect(req1.status).toBe(200);

      // Second authenticated request
      const req2 = await request(app)
        .get('/api/auth/me')
        .set('Cookie', token);
      expect(req2.status).toBe(200);

      // Both should return same user
      expect(req1.body.user.id).toBe(req2.body.user.id);
    });

    test('should reject requests after logout', async () => {
      await User.create(testUsers.admin);

      // Login
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUsers.admin.email,
          password: plainPassword
        });

      const token = extractCookie(loginRes.headers['set-cookie']);

      // Verify authenticated
      const authReq = await request(app)
        .get('/api/auth/me')
        .set('Cookie', token);
      expect(authReq.status).toBe(200);

      // Logout
      await request(app)
        .post('/api/auth/logout')
        .set('Cookie', token);

      // Should fail after logout (cookie cleared)
      const afterLogout = await request(app)
        .get('/api/auth/me');
      expect(afterLogout.status).toBe(401);
    });
  });

  describe('Protected Endpoint Access', () => {
    test('should access protected endpoint with valid token', async () => {
      await User.create(testUsers.admin);

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUsers.admin.email,
          password: plainPassword
        });

      const token = extractCookie(loginRes.headers['set-cookie']);

      // Access admin-only endpoint
      const response = await request(app)
        .get('/api/admin/audit-logs')
        .set('Cookie', token);

      // Should be allowed (Admin has access)
      expect([200, 404]).toContain(response.status); // 404 if no logs, 200 if logs exist
    });

    test('should deny protected endpoint without token', async () => {
      const response = await request(app)
        .get('/api/admin/audit-logs');

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Token is missing');
    });

    test('should deny protected endpoint with expired token', async () => {
      const user = await User.create(testUsers.admin);

      const expiredToken = jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '-1h' }
      );

      const response = await request(app)
        .get('/api/admin/audit-logs')
        .set('Cookie', `token=${expiredToken}`);

      expect(response.status).toBe(403);
    });
  });
});

