const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { canRegister } = require('../utils/registrationRoles');
const logger = require('../config/logger');

/**
 * Get all users with role-based access control
 * @route GET /api/users
 * @access Private (Admin, Manager)
 */
exports.getAllUsers = async (req, res) => {
  const requester = req.user;

  try {
    // Only Admin and Manager can see all users
    if (requester.role !== 'Admin' && requester.role !== 'Manager') {
      logger.warn('Unauthorized access attempt to user list', {
        userId: requester.id,
        userRole: requester.role
      });
      return res.status(403).json({ 
        message: 'Access denied. Only Admin and Manager can view all users.' 
      });
    }

    const users = await User.find().select('-password');
    
    logger.info('Users list retrieved', {
      requesterId: requester.id,
      requesterRole: requester.role,
      userCount: users.length
    });

    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (err) {
    logger.error('Failed to retrieve users', { 
      error: err.message,
      requesterId: requester.id
    });
    res.status(500).json({ message: 'Failed to retrieve users' });
  }
};

/**
 * Register a new user
 * @route POST /api/users/register
 * @access Private (Admin, Manager, Employee)
 */
exports.registerUser = async (req, res) => {
  const creator = req.user;

  const { 
    name, email, password, role,
    phone, address, dateOfBirth, gender,
    employeeId, providerId
  } = req.body;
  try {
    if (!canRegister[role]?.includes(creator.role)) {
      logger.warn('Registration denied: Insufficient permissions', {
        creatorId: creator.id,
        creatorRole: creator.role,
        targetRole: role
      });
      return res.status(403).json({ message: `Not allowed to register this ${role}` });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      logger.warn('Registration failed: User already exists', { email });
      return res.status(409).json({ message: 'User already exists' });
    }

    const user = new User({
      name, email, password, role,
      phone, address, gender,
      dateOfBirth: role === 'Patient' ? dateOfBirth : undefined,
      employeeId: role === 'Employee' ? employeeId : undefined,
      providerId: role === 'Provider' ? providerId : undefined
    });

    await user.save();

    await AuditLog.create({
      action: 'REGISTER_USER',
      actorId: creator.id,
      targetId: user._id,
      targetType: 'User',
      details: `Created ${role}: ${user.name}`,
      ipAddress: req.ip
    });

    logger.info('User registered successfully', {
      creatorId: creator.id,
      creatorRole: creator.role,
      newUserId: user._id,
      newUserRole: role
    });

    res.status(201).json({
      message: 'User registered successfully'
    });
  } catch (err) {
    logger.error('User registration failed', { 
      error: err.message,
      creatorId: creator.id,
      targetRole: role
    });
    res.status(500).json({ message: 'User registration failed' });
  }
};

/**
 * Update user information
 * @route PUT /api/users/:id
 * @access Private (Admin, Manager, Employee, or self for limited fields)
 */
exports.updateUser = async (req, res) => {
  const requester = req.user;
  const { id } = req.params;

  try {
    const user = await User.findById(id);
    if (!user) {
      logger.warn('Update failed: User not found', { userId: id, requesterId: requester.id });
      return res.status(404).json({ message: 'User not found' });
    }

    const isSelf = requester.id === user.id;
    const isAdmin = requester.role === 'Admin';
    const isManager = requester.role === 'Manager';
    const isEmployee = requester.role === 'Employee';

    // Patient can only update their own phone/address
    if (user.role === 'Patient') {
      if(isSelf) {
        // Allow self to update phone/address only
        const { phone, address } = req.body;
        user.phone = phone || user.phone;
        user.address = address || user.address;
        logger.info('Patient self-update', { userId: user._id, fields: ['phone', 'address'] });
      }
      else if (isAdmin || isManager || isEmployee) {
        // Allow admin/manager/employee to update any field
        Object.assign(user, req.body);
        logger.info('Patient updated by staff', { 
          userId: user._id, 
          updatedBy: requester.id,
          updaterRole: requester.role 
        });
      }
      else {
        logger.warn('Update denied: Not authorized to update patient', {
          requesterId: requester.id,
          requesterRole: requester.role,
          targetUserId: user._id
        });
        return res.status(403).json({ message: 'Not authorized to update this patient' });
      }
    }
    
    // Employee details can only be updated by Admin or Manager
    else if (user.role === 'Employee') {
      if (!(isAdmin || isManager)) {
        logger.warn('Update denied: Not authorized to update employee', {
          requesterId: requester.id,
          requesterRole: requester.role
        });
        return res.status(403).json({ message: 'Only admin or manager authorized to update this employee' });
      }
      Object.assign(user, req.body);
    }

    // Provider details can only be updated by Admin or Manager
    else if (user.role === 'Provider') {
      if (!(isAdmin || isManager)) {
        logger.warn('Update denied: Not authorized to update provider', {
          requesterId: requester.id,
          requesterRole: requester.role
        });
        return res.status(403).json({ message: 'Only admin or manager authorized to update this provider' });
      }
      Object.assign(user, req.body);
    }

    // Manager details can only be updated by Admin
    else if (user.role === 'Manager') {
      if (!isAdmin) {
        logger.warn('Update denied: Not authorized to update manager', {
          requesterId: requester.id,
          requesterRole: requester.role
        });
        return res.status(403).json({ message: 'Only admin authorized to update this manager' });
      }
      Object.assign(user, req.body);
    }

    await user.save();

    await AuditLog.create({
      action: 'UPDATE_USER',
      actorId: requester.id,
      targetId: user._id,
      targetType: 'User',
      details: `Updated user ${user.name} with role ${user.role}`,
      ipAddress: req.ip
    });

    logger.info('User updated successfully', {
      userId: user._id,
      updatedBy: requester.id,
      role: user.role
    });

    res.json({
      message: `User ${user.name} with role ${user.role} updated successfully`
    });
  } catch (err) {
    logger.error('User update failed', { 
      error: err.message,
      userId: id,
      requesterId: requester.id
    });
    res.status(500).json({ message: 'User update failed', error: err.message });
  }
};
