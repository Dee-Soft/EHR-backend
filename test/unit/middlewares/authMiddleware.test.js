const { authMiddleware, requiredRole } = require('../../../middlewares/authMiddleware');
const jwt = require('jsonwebtoken');

// Mock jwt
jest.mock('jsonwebtoken');

// Mock AuditLog model to prevent database operations
jest.mock('../../../models/AuditLog', () => ({
  create: jest.fn().mockResolvedValue({})
}));

describe('Auth Middleware', () => {
  let req, res, next;
  
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Setup mock request, response, and next
    req = {
      cookies: {}
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    
    next = jest.fn();
  });
  
  describe('authMiddleware', () => {
    test('should call next() when valid token is provided', () => {
      const mockUser = { id: 'user123', role: 'Patient', email: 'test@test.com' };
      req.cookies.token = 'valid-token';
      jwt.verify.mockReturnValue(mockUser);
      
      authMiddleware(req, res, next);
      
      expect(jwt.verify).toHaveBeenCalledWith('valid-token', process.env.JWT_SECRET);
      expect(req.user).toEqual(mockUser);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
    
    test('should return 401 when token is missing', () => {
      authMiddleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Token is missing' });
      expect(next).not.toHaveBeenCalled();
    });
    
    test('should return 403 when token is invalid', async () => {
      req.cookies.token = 'invalid-token';
      jwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });
      
      await authMiddleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Failed to authenticate token' });
      expect(next).not.toHaveBeenCalled();
    });
    
    test('should return 403 when token is expired', async () => {
      req.cookies.token = 'expired-token';
      jwt.verify.mockImplementation(() => {
        const error = new Error('Token expired');
        error.name = 'TokenExpiredError';
        throw error;
      });
      
      await authMiddleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Failed to authenticate token' });
      expect(next).not.toHaveBeenCalled();
    });
    
    test('should attach decoded user to request object', () => {
      const mockUser = { id: 'user456', role: 'Provider', email: 'provider@test.com' };
      req.cookies.token = 'valid-token';
      jwt.verify.mockReturnValue(mockUser);
      
      authMiddleware(req, res, next);
      
      expect(req.user).toEqual(mockUser);
      expect(req.user.id).toBe('user456');
      expect(req.user.role).toBe('Provider');
    });
  });
  
  describe('requiredRole', () => {
    beforeEach(() => {
      // Assume user is already authenticated
      req.user = { id: 'user123', role: 'Patient', email: 'patient@test.com' };
    });
    
    test('should call next() when user has required role', () => {
      const middleware = requiredRole('Patient');
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
    
    test('should call next() when user has one of multiple required roles', () => {
      const middleware = requiredRole('Admin', 'Patient', 'Provider');
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
    
    test('should return 403 when user does not have required role', async () => {
      const middleware = requiredRole('Admin');
      
      await middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Access denied' });
      expect(next).not.toHaveBeenCalled();
    });
    
    test('should return 403 when user role is not in list of required roles', async () => {
      const middleware = requiredRole('Admin', 'Manager', 'Provider');
      
      await middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Access denied' });
      expect(next).not.toHaveBeenCalled();
    });
    
    test('should return 403 when user object is missing', async () => {
      req.user = null;
      const middleware = requiredRole('Patient');
      
      await middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Access denied' });
      expect(next).not.toHaveBeenCalled();
    });
    
    test('should return 403 when user role is undefined', async () => {
      req.user = { id: 'user123', email: 'test@test.com' }; // No role
      const middleware = requiredRole('Patient');
      
      await middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Access denied' });
      expect(next).not.toHaveBeenCalled();
    });
    
    test('should work with Admin role', () => {
      req.user.role = 'Admin';
      const middleware = requiredRole('Admin');
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
    });
    
    test('should work with Provider role', () => {
      req.user.role = 'Provider';
      const middleware = requiredRole('Provider');
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
    });
    
    test('should work with Manager role', () => {
      req.user.role = 'Manager';
      const middleware = requiredRole('Manager');
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
    });
    
    test('should work with Employee role', () => {
      req.user.role = 'Employee';
      const middleware = requiredRole('Employee');
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
    });
  });
});
