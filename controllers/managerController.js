const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const PatientRecord = require('../models/PatientRecord');
const logger = require('../config/logger');

// Import employee controller functions that managers can also use
const employeeController = require('./employeeController');

/**
 * Get all employees
 * @route GET /api/managers/employees
 * @access Manager, Admin
 */
exports.getAllEmployees = async (req, res) => {
  try {
    const employees = await User.find({ role: 'Employee' })
      .select('-password')
      .lean();

    logger.info('Employees retrieved by manager', {
      managerId: req.user.id,
      employeeCount: employees.length
    });

    res.status(200).json({
      success: true,
      count: employees.length,
      data: employees
    });
  } catch (error) {
    logger.error('Failed to retrieve employees', {
      error: error.message,
      managerId: req.user.id
    });
    res.status(500).json({ 
      message: 'Failed to retrieve employees',
      error: error.message 
    });
  }
};

/**
 * Update employee information
 * @route PUT /api/managers/employees/:id
 * @access Manager, Admin
 */
exports.updateEmployee = async (req, res) => {
  const { id } = req.params;
  const managerId = req.user.id;
  const managerRole = req.user.role;

  try {
    const employee = await User.findById(id);

    if (!employee) {
      return res.status(404).json({ 
        message: 'Employee not found' 
      });
    }

    if (employee.role !== 'Employee') {
      return res.status(400).json({ 
        message: 'User is not an employee' 
      });
    }

    // Prevent managers from updating themselves via this route
    if (employee._id.toString() === managerId) {
      return res.status(400).json({ 
        message: 'Cannot update your own account via manager route' 
      });
    }

    // Update allowed fields
    const allowedUpdates = ['name', 'email', 'phone', 'address', 'employeeId'];
    const updates = {};
    
    for (const field of allowedUpdates) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    // Apply updates
    Object.assign(employee, updates);
    await employee.save();

    // Create audit log
    await AuditLog.create({
      action: 'UPDATE_EMPLOYEE',
      actorId: managerId,
      targetId: employee._id,
      targetType: 'User',
      details: `Updated employee ${employee.name} by ${managerRole}`,
      ipAddress: req.ip
    });

    logger.info('Employee updated successfully', {
      managerId,
      managerRole,
      employeeId: employee._id,
      updatedFields: Object.keys(updates)
    });

    res.status(200).json({
      success: true,
      message: 'Employee updated successfully',
      data: {
        id: employee._id,
        name: employee.name,
        email: employee.email,
        employeeId: employee.employeeId,
        updatedFields: Object.keys(updates)
      }
    });
  } catch (error) {
    logger.error('Failed to update employee', {
      error: error.message,
      managerId,
      employeeId: id
    });
    res.status(500).json({ 
      message: 'Failed to update employee',
      error: error.message 
    });
  }
};

/**
 * Delete employee
 * @route DELETE /api/managers/employees/:id
 * @access Manager, Admin
 */
exports.deleteEmployee = async (req, res) => {
  const { id } = req.params;
  const managerId = req.user.id;
  const managerRole = req.user.role;

  try {
    const employee = await User.findById(id);

    if (!employee) {
      return res.status(404).json({ 
        message: 'Employee not found' 
      });
    }

    if (employee.role !== 'Employee') {
      return res.status(400).json({ 
        message: 'User is not an employee' 
      });
    }

    // Prevent deletion of own account
    if (employee._id.toString() === managerId) {
      return res.status(400).json({ 
        message: 'Cannot delete your own account' 
      });
    }

    // Delete the employee
    await User.findByIdAndDelete(id);

    // Create audit log
    await AuditLog.create({
      action: 'DELETE_EMPLOYEE',
      actorId: managerId,
      targetId: employee._id,
      targetType: 'User',
      details: `Deleted employee ${employee.name} by ${managerRole}`,
      ipAddress: req.ip
    });

    logger.info('Employee deleted successfully', {
      managerId,
      managerRole,
      employeeId: employee._id,
      employeeName: employee.name
    });

    res.status(200).json({
      success: true,
      message: 'Employee deleted successfully'
    });
  } catch (error) {
    logger.error('Failed to delete employee', {
      error: error.message,
      managerId,
      employeeId: id
    });
    res.status(500).json({ 
      message: 'Failed to delete employee',
      error: error.message 
    });
  }
};

/**
 * Manage provider (update provider information)
 * @route PUT /api/managers/providers/:id
 * @access Manager, Admin
 */
exports.manageProvider = async (req, res) => {
  const { id } = req.params;
  const managerId = req.user.id;
  const managerRole = req.user.role;

  try {
    const provider = await User.findById(id);

    if (!provider) {
      return res.status(404).json({ 
        message: 'Provider not found' 
      });
    }

    if (provider.role !== 'Provider') {
      return res.status(400).json({ 
        message: 'User is not a provider' 
      });
    }

    // Update allowed fields
    const allowedUpdates = ['name', 'email', 'phone', 'providerId'];
    const updates = {};
    
    for (const field of allowedUpdates) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    // Apply updates
    Object.assign(provider, updates);
    await provider.save();

    // Create audit log
    await AuditLog.create({
      action: 'UPDATE_PROVIDER',
      actorId: managerId,
      targetId: provider._id,
      targetType: 'User',
      details: `Updated provider ${provider.name} by ${managerRole}`,
      ipAddress: req.ip
    });

    logger.info('Provider updated successfully', {
      managerId,
      managerRole,
      providerId: provider._id,
      updatedFields: Object.keys(updates)
    });

    res.status(200).json({
      success: true,
      message: 'Provider updated successfully',
      data: {
        id: provider._id,
        name: provider.name,
        email: provider.email,
        providerId: provider.providerId,
        updatedFields: Object.keys(updates)
      }
    });
  } catch (error) {
    logger.error('Failed to update provider', {
      error: error.message,
      managerId,
      providerId: id
    });
    res.status(500).json({ 
      message: 'Failed to update provider',
      error: error.message 
    });
  }
};

/**
 * Get system statistics
 * @route GET /api/managers/system-stats
 * @access Manager, Admin
 */
exports.getSystemStats = async (req, res) => {
  try {
    // Get counts for each role
    const roleCounts = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);

    // Get total patient records
    const totalRecords = await PatientRecord.countDocuments();

    // Get assignments statistics
    const providersWithPatients = await User.countDocuments({
      role: 'Provider',
      assignedPatients: { $exists: true, $ne: [] }
    });

    const totalProviders = await User.countDocuments({ role: 'Provider' });
    const totalPatients = await User.countDocuments({ role: 'Patient' });
    const patientsWithProviders = await User.countDocuments({
      role: 'Patient',
      assignedProviderId: { $ne: null }
    });

    const stats = {
      users: {
        total: await User.countDocuments(),
        byRole: roleCounts.reduce((acc, curr) => {
          acc[curr._id] = curr.count;
          return acc;
        }, {})
      },
      records: {
        total: totalRecords
      },
      assignments: {
        providers: {
          total: totalProviders,
          withPatients: providersWithPatients,
          percentage: totalProviders > 0 ? (providersWithPatients / totalProviders * 100).toFixed(2) : 0
        },
        patients: {
          total: totalPatients,
          withProviders: patientsWithProviders,
          percentage: totalPatients > 0 ? (patientsWithProviders / totalPatients * 100).toFixed(2) : 0
        }
      },
      lastUpdated: new Date()
    };

    logger.info('System statistics retrieved by manager', {
      managerId: req.user.id,
      statsSummary: {
        totalUsers: stats.users.total,
        totalRecords: stats.records.total
      }
    });

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Failed to retrieve system statistics', {
      error: error.message,
      managerId: req.user.id
    });
    res.status(500).json({ 
      message: 'Failed to retrieve system statistics',
      error: error.message 
    });
  }
};

// Re-export employee controller functions that managers can also use
exports.getAllProviders = employeeController.getAllProviders;
exports.getAllPatients = employeeController.getAllPatients;
exports.getAssignments = employeeController.getAssignments;
exports.assignPatientToProvider = employeeController.assignPatientToProvider;
