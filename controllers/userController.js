const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { canRegister } = require('../utils/registrationRoles');
const { canUserUpdate, getAllowedUpdateFields } = require('../utils/updateRoles');
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
    employeeId, providerId, managerId, adminId
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

    // Validate dateOfBirth format if provided (for Patient role)
    if (role === 'Patient' && dateOfBirth) {
      // Check if dateOfBirth is in dd-mm-yyyy format
      const dateRegex = /^\d{2}-\d{2}-\d{4}$/;
      if (!dateRegex.test(dateOfBirth)) {
        return res.status(400).json({ 
          message: 'Invalid dateOfBirth format. Expected dd-mm-yyyy format' 
        });
      }
      
      // Try to parse the date to ensure it's valid
      try {
        const [day, month, year] = dateOfBirth.split('-').map(Number);
        const testDate = new Date(year, month - 1, day);
        if (isNaN(testDate.getTime())) {
          return res.status(400).json({ 
            message: 'Invalid dateOfBirth. Please provide a valid date in dd-mm-yyyy format' 
          });
        }
      } catch (error) {
        return res.status(400).json({ 
          message: 'Invalid dateOfBirth format. Expected dd-mm-yyyy format' 
        });
      }
    }

    const user = new User({
      name, email, password, role,
      phone, address, gender,
      dateOfBirth: role === 'Patient' ? dateOfBirth : undefined,
      employeeId: role === 'Employee' ? employeeId : undefined,
      providerId: role === 'Provider' ? providerId : undefined,
      managerId: role === 'Manager' ? managerId : undefined,
      adminId: role === 'Admin' ? adminId : undefined
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
      success: true,
      message: 'User registered successfully',
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        ...(user.employeeId && { employeeId: user.employeeId }),
        ...(user.providerId && { providerId: user.providerId }),
        ...(user.managerId && { managerId: user.managerId }),
        ...(user.adminId && { adminId: user.adminId })
      }
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
    
    // Check if requester can update this user
    if (!canUserUpdate(requester.role, user.role, isSelf)) {
      logger.warn('Update denied: Not authorized to update user', {
        requesterId: requester.id,
        requesterRole: requester.role,
        targetUserId: user._id,
        targetUserRole: user.role,
        isSelf
      });
      return res.status(403).json({ message: 'Not authorized to update this user' });
    }

    // Get allowed update fields based on requester role and target role
    const allowedFields = getAllowedUpdateFields(requester.role, user.role, isSelf);
    
    // Filter updates to only include allowed fields
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    // Validate dateOfBirth format if being updated
    if (updates.dateOfBirth !== undefined) {
      const dateOfBirth = updates.dateOfBirth;
      // Check if dateOfBirth is in dd-mm-yyyy format
      const dateRegex = /^\d{2}-\d{2}-\d{4}$/;
      if (!dateRegex.test(dateOfBirth)) {
        return res.status(400).json({ 
          message: 'Invalid dateOfBirth format. Expected dd-mm-yyyy format' 
        });
      }
      
      // Try to parse the date to ensure it's valid
      try {
        const [day, month, year] = dateOfBirth.split('-').map(Number);
        const testDate = new Date(year, month - 1, day);
        if (isNaN(testDate.getTime())) {
          return res.status(400).json({ 
            message: 'Invalid dateOfBirth. Please provide a valid date in dd-mm-yyyy format' 
          });
        }
      } catch (error) {
        return res.status(400).json({ 
          message: 'Invalid dateOfBirth format. Expected dd-mm-yyyy format' 
        });
      }
    }

    // Special handling for role-specific ID fields
    // Ensure ID fields are only set for the correct role
    if (user.role === 'Employee' && updates.employeeId !== undefined) {
      user.employeeId = updates.employeeId;
    }
    if (user.role === 'Provider' && updates.providerId !== undefined) {
      user.providerId = updates.providerId;
    }
    if (user.role === 'Manager' && updates.managerId !== undefined) {
      user.managerId = updates.managerId;
    }
    if (user.role === 'Admin' && updates.adminId !== undefined) {
      user.adminId = updates.adminId;
    }

    // Apply other updates (excluding role-specific ID fields which were handled above)
    const otherFields = Object.keys(updates).filter(field => 
      !['employeeId', 'providerId', 'managerId', 'adminId'].includes(field)
    );
    
    for (const field of otherFields) {
      user[field] = updates[field];
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
      requesterRole: requester.role,
      targetRole: user.role,
      updatedFields: Object.keys(updates),
      isSelf
    });

    res.json({
      success: true,
      message: `User ${user.name} with role ${user.role} updated successfully`,
      data: {
        id: user._id,
        name: user.name,
        role: user.role,
        updatedFields: Object.keys(updates)
      }
    });
  } catch (err) {
    logger.error('User update failed', { 
      error: err.message,
      userId: id,
      requesterId: requester.id,
      requesterRole: requester.role
    });
    res.status(500).json({ 
      success: false,
      message: 'User update failed', 
      error: err.message 
    });
  }
};
