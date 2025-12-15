const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../setup/testDb');
const { testUsers, plainPassword } = require('../setup/fixtures/users.fixture');
const User = require('../../models/User');
const AuditLog = require('../../models/AuditLog');

// Import app - will be available after server.js exports it
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
    // Import app after DB connection to avoid connection issues
    app = require('../../server');
  });
  
  afterEach(async () => {
    await clearDatabase();
  });
  
  afterAll(async () => {
    await closeDatabase();
  });
  
  describe('POST /api/auth/login', () => {
    test('should login with valid credentials and return user data', async () => {
      // Arrange: Create test user
      await User.create(testUsers.patient);
      
      // Act: Attempt login
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUsers.patient.email,
          password: plainPassword
        });
      
      // Assert
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Login successful');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user.role).toBe('Patient');
      expect(response.body.user.email).toBe(testUsers.patient.email);
      expect(response.body.user.name).toBe(testUsers.patient.name);
      expect(response.headers['set-cookie']).toBeDefined();
      
      // Verify token cookie is set
      const cookies = response.headers['set-cookie'];
      expect(cookies.some(cookie => cookie.startsWith('token='))).toBe(true);
    });
    
    test('should create audit log on successful login', async () => {
      // Arrange
      const user = await User.create(testUsers.admin);
      
      // Act
      await request(app)
        .post('/api/auth/login')
        .send({
          email: testUsers.admin.email,
          password: plainPassword
        });
      
      // Assert: Check audit log was created
      const auditLogs = await AuditLog.find({ action: 'login' });
      expect(auditLogs.length).toBe(1);
      expect(auditLogs[0].actorId.toString()).toBe(user._id.toString());
      expect(auditLogs[0].details).toContain('logged in successfully');
    });
    
    test('should reject login with invalid email', async () => {
      await User.create(testUsers.patient);
      
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: plainPassword
        });
      
      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid credentials');
      expect(response.headers['set-cookie']).toBeUndefined();
    });
    
    test('should reject login with incorrect password', async () => {
      await User.create(testUsers.patient);
      
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUsers.patient.email,
          password: 'WrongPassword123!'
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
    
    test('should work for different user roles', async () => {
      // Test Admin
      await User.create(testUsers.admin);
      let response = await request(app)
        .post('/api/auth/login')
        .send({ email: testUsers.admin.email, password: plainPassword });
      expect(response.status).toBe(200);
      expect(response.body.user.role).toBe('Admin');
      
      await clearDatabase();
      
      // Test Provider
      await User.create(testUsers.provider);
      response = await request(app)
        .post('/api/auth/login')
        .send({ email: testUsers.provider.email, password: plainPassword });
      expect(response.status).toBe(200);
      expect(response.body.user.role).toBe('Provider');
    });
  });
  
  describe('GET /api/auth/me', () => {
    test('should return current user data when authenticated', async () => {
      // Arrange: Create user and login
      await User.create(testUsers.patient);
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUsers.patient.email,
          password: plainPassword
        });
      
      const cookies = extractCookie(loginResponse.headers['set-cookie']);
      
      // Act: Get current user
      const response = await request(app)
        .get('/api/auth/me')
        .set('Cookie', cookies);
      
      // Assert
      expect(response.status).toBe(200);
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user.role).toBe('Patient');
      expect(response.body.user.email).toBe(testUsers.patient.email);
    });
    
    test('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .get('/api/auth/me');
      
      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Token is missing');
    });
    
    test('should return 403 with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Cookie', 'token=invalid-token-here');
      
      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Failed to authenticate token');
    });
  });
  
  describe('POST /api/auth/logout', () => {
    test('should logout and clear cookie', async () => {
      // Arrange: Login first
      await User.create(testUsers.patient);
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUsers.patient.email,
          password: plainPassword
        });
      
      const cookies = extractCookie(loginResponse.headers['set-cookie']);
      
      // Act: Logout
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', cookies);
      
      // Assert
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Logged out successfully');
      
      // Verify cookie is cleared
      const setCookieHeader = response.headers['set-cookie'];
      expect(setCookieHeader).toBeDefined();
      expect(setCookieHeader[0]).toContain('token=');
    });
    
    test('should allow logout even without valid token', async () => {
      const response = await request(app)
        .post('/api/auth/logout');
      
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Logged out successfully');
    });
  });
  
  describe('Authentication Flow', () => {
    test('should complete full auth flow: login -> access protected route -> logout', async () => {
      // Step 1: Create user
      await User.create(testUsers.admin);
      
      // Step 2: Login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUsers.admin.email,
          password: plainPassword
        });
      expect(loginResponse.status).toBe(200);
      
      const cookies = extractCookie(loginResponse.headers['set-cookie']);
      
      // Step 3: Access protected route
      const meResponse = await request(app)
        .get('/api/auth/me')
        .set('Cookie', cookies);
      expect(meResponse.status).toBe(200);
      
      // Step 4: Logout
      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', cookies);
      expect(logoutResponse.status).toBe(200);
      
      // Step 5: Try to access protected route after logout (should fail)
      const afterLogoutResponse = await request(app)
        .get('/api/auth/me')
        .set('Cookie', extractCookie(logoutResponse.headers['set-cookie']));
      expect(afterLogoutResponse.status).toBe(401);
    });
  });
});
