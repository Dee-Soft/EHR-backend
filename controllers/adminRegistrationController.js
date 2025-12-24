const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { canRegister } = require('../utils/registrationRoles');
const logger = require('../config/logger');

/**
 * Register a new user (Admin can register all roles)
 * @route POST /api/admin/register
 * @access Private (Admin only)
 */
exports.registerUser = async (req, res) => {
  const admin = req.user;

  const { 
    name, email, password, role,
    phone, address, dateOfBirth, gender,
    employeeId, providerId, managerId, adminId
  } = req.body;

  try {
    // Verify admin is making the request
    if (admin.role !== 'Admin') {
      logger.warn('Registration denied: Not an admin', {
        userId: admin.id,
        userRole: admin.role
      });
      return res.status(403).json({ message: 'Only admin can use this endpoint' });
    }

    // Check if admin can register this role
    if (!canRegister[role]?.includes('Admin')) {
      logger.warn('Registration denied: Admin cannot register this role', {
        adminId: admin.id,
        targetRole: role
      });
      return res.status(403).json({ message: `Admin cannot register ${role} role` });
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

    // Add role-specific fields
    if (role === 'Patient') {
      userData.dateOfBirth = dateOfBirth;
    } else if (role === 'Employee') {
      userData.employeeId = employeeId;
    } else if (role === 'Provider') {
      userData.providerId = providerId;
    } else if (role === 'Manager') {
      userData.managerId = managerId;
    } else if (role === 'Admin') {
      userData.adminId = adminId;
    }

    const user = new User(userData);
    await user.save();

    // Create audit log
    await AuditLog.create({
      action: 'REGISTER_USER',
      actorId: admin.id,
      targetId: user._id,
      targetType: 'User',
      details: `Admin registered ${role}: ${user.name}`,
      ipAddress: req.ip
    });

    logger.info('User registered successfully by admin', {
      adminId: admin.id,
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
    logger.error('User registration failed by admin', { 
      error: err.message,
      adminId: admin.id,
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
 * Register multiple users at once (Admin only)
 * @route POST /api/admin/register/bulk
 * @access Private (Admin only)
 */
exports.registerUsersBulk = async (req, res) => {
  const admin = req.user;
  const users = req.body.users; // Array of user objects

  try {
    // Verify admin is making the request
    if (admin.role !== 'Admin') {
      return res.status(403).json({ message: 'Only admin can use this endpoint' });
    }

    if (!Array.isArray(users) || users.length === 0) {
      return res.status(400).json({ message: 'Users array is required and cannot be empty' });
    }

    const results = {
      successful: [],
      failed: []
    };

    // Process each user
    for (const userData of users) {
      try {
        const { 
          name, email, password, role,
          phone, address, dateOfBirth, gender,
          employeeId, providerId, managerId, adminId
        } = userData;

        // Check if admin can register this role
        if (!canRegister[role]?.includes('Admin')) {
          results.failed.push({
            email,
            error: `Admin cannot register ${role} role`
          });
          continue;
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
          results.failed.push({
            email,
            error: 'User already exists'
          });
          continue;
        }

        // Create user object with role-specific fields
        const newUserData = {
          name, email, password, role,
          phone, address, gender
        };

        // Add role-specific fields
        if (role === 'Patient') {
          newUserData.dateOfBirth = dateOfBirth;
        } else if (role === 'Employee') {
          newUserData.employeeId = employeeId;
        } else if (role === 'Provider') {
          newUserData.providerId = providerId;
        } else if (role === 'Manager') {
          newUserData.managerId = managerId;
        } else if (role === 'Admin') {
          newUserData.adminId = adminId;
        }

        const user = new User(newUserData);
        await user.save();

        // Create audit log for each user
        await AuditLog.create({
          action: 'REGISTER_USER_BULK',
          actorId: admin.id,
          targetId: user._id,
          targetType: 'User',
          details: `Admin registered ${role}: ${user.name} (bulk registration)`,
          ipAddress: req.ip
        });

        results.successful.push({
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        });

      } catch (err) {
        results.failed.push({
          email: userData.email,
          error: err.message
        });
      }
    }

    logger.info('Bulk user registration completed by admin', {
      adminId: admin.id,
      successful: results.successful.length,
      failed: results.failed.length
    });

    res.status(201).json({
      success: true,
      message: 'Bulk registration completed',
      data: results
    });
  } catch (err) {
    logger.error('Bulk user registration failed by admin', { 
      error: err.message,
      adminId: admin.id
    });
    res.status(500).json({ 
      success: false,
      message: 'Bulk registration failed',
      error: err.message 
    });
  }
};
