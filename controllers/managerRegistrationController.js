const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { canRegister } = require('../utils/registrationRoles');
const logger = require('../config/logger');

/**
 * Register a new user (Manager can register Patient, Provider, Employee)
 * @route POST /api/manager/register
 * @access Private (Manager, Admin)
 */
exports.registerUser = async (req, res) => {
  const manager = req.user;

  const { 
    name, email, password, role,
    phone, address, dateOfBirth, gender,
    employeeId, providerId
  } = req.body;

  try {
    // Verify manager or admin is making the request
    if (manager.role !== 'Manager' && manager.role !== 'Admin') {
      logger.warn('Registration denied: Not a manager or admin', {
        userId: manager.id,
        userRole: manager.role
      });
      return res.status(403).json({ message: 'Only manager or admin can use this endpoint' });
    }

    // Check if manager can register this role
    if (!canRegister[role]?.includes('Manager')) {
      logger.warn('Registration denied: Manager cannot register this role', {
        managerId: manager.id,
        managerRole: manager.role,
        targetRole: role
      });
      return res.status(403).json({ message: `Manager cannot register ${role} role` });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      logger.warn('Registration failed: User already exists', { email });
      return res.status(409).json({ message: 'User already exists' });
    }

    // Create user object with role-specific fields
    const userData = {
      name, email, password, role,
      phone, address, gender
    };

    // Add role-specific fields (Manager cannot register Manager or Admin)
    if (role === 'Patient') {
      userData.dateOfBirth = dateOfBirth;
    } else if (role === 'Employee') {
      userData.employeeId = employeeId;
    } else if (role === 'Provider') {
      userData.providerId = providerId;
    }

    const user = new User(userData);
    await user.save();

    // Create audit log
    await AuditLog.create({
      action: 'REGISTER_USER',
      actorId: manager.id,
      targetId: user._id,
      targetType: 'User',
      details: `${manager.role} registered ${role}: ${user.name}`,
      ipAddress: req.ip
    });

    logger.info('User registered successfully by manager', {
      managerId: manager.id,
      managerRole: manager.role,
      newUserId: user._id,
      newUserRole: role
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        ...(user.employeeId && { employeeId: user.employeeId }),
        ...(user.providerId && { providerId: user.providerId })
      }
    });
  } catch (err) {
    logger.error('User registration failed by manager', { 
      error: err.message,
      managerId: manager.id,
      managerRole: manager.role,
      targetRole: role
    });
    res.status(500).json({ 
      success: false,
      message: 'User registration failed',
      error: err.message 
    });
  }
};

/**
 * Register a new employee (Manager-specific endpoint)
 * @route POST /api/manager/register/employee
 * @access Private (Manager, Admin)
 */
exports.registerEmployee = async (req, res) => {
  const manager = req.user;

  const { 
    name, email, password,
    phone, address, gender, employeeId
  } = req.body;

  try {
    // Verify manager or admin is making the request
    if (manager.role !== 'Manager' && manager.role !== 'Admin') {
      return res.status(403).json({ message: 'Only manager or admin can use this endpoint' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: 'User already exists' });
    }

    // Create employee user
    const user = new User({
      name, email, password,
      phone, address, gender,
      role: 'Employee',
      employeeId
    });

    await user.save();

    // Create audit log
    await AuditLog.create({
      action: 'REGISTER_EMPLOYEE',
      actorId: manager.id,
      targetId: user._id,
      targetType: 'User',
      details: `${manager.role} registered employee: ${user.name}`,
      ipAddress: req.ip
    });

    logger.info('Employee registered successfully by manager', {
      managerId: manager.id,
      managerRole: manager.role,
      employeeId: user._id
    });

    res.status(201).json({
      success: true,
      message: 'Employee registered successfully',
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: 'Employee',
        employeeId: user.employeeId
      }
    });
  } catch (err) {
    logger.error('Employee registration failed by manager', { 
      error: err.message,
      managerId: manager.id,
      managerRole: manager.role
    });
    res.status(500).json({ 
      success: false,
      message: 'Employee registration failed',
      error: err.message 
    });
  }
};

/**
 * Register a new provider (Manager-specific endpoint)
 * @route POST /api/manager/register/provider
 * @access Private (Manager, Admin)
 */
exports.registerProvider = async (req, res) => {
  const manager = req.user;

  const { 
    name, email, password,
    phone, address, gender, providerId
  } = req.body;

  try {
    // Verify manager or admin is making the request
    if (manager.role !== 'Manager' && manager.role !== 'Admin') {
      return res.status(403).json({ message: 'Only manager or admin can use this endpoint' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: 'User already exists' });
    }

    // Create provider user
    const user = new User({
      name, email, password,
      phone, address, gender,
      role: 'Provider',
      providerId
    });

    await user.save();

    // Create audit log
    await AuditLog.create({
      action: 'REGISTER_PROVIDER',
      actorId: manager.id,
      targetId: user._id,
      targetType: 'User',
      details: `${manager.role} registered provider: ${user.name}`,
      ipAddress: req.ip
    });

    logger.info('Provider registered successfully by manager', {
      managerId: manager.id,
      managerRole: manager.role,
      providerId: user._id
    });

    res.status(201).json({
      success: true,
      message: 'Provider registered successfully',
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: 'Provider',
        providerId: user.providerId
      }
    });
  } catch (err) {
    logger.error('Provider registration failed by manager', { 
      error: err.message,
      managerId: manager.id,
      managerRole: manager.role
    });
    res.status(500).json({ 
      success: false,
      message: 'Provider registration failed',
      error: err.message 
    });
  }
};
