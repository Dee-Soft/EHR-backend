const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { canRegister } = require('../utils/registrationRoles');
const logger = require('../config/logger');

/**
 * Register a new patient (Employee can register Patient only)
 * @route POST /api/employee/register/patient
 * @access Private (Employee, Manager, Admin)
 */
exports.registerPatient = async (req, res) => {
  const employee = req.user;

  const { 
    name, email, password,
    phone, address, dateOfBirth, gender
  } = req.body;

  try {
    // Verify employee, manager, or admin is making the request
    if (employee.role !== 'Employee' && employee.role !== 'Manager' && employee.role !== 'Admin') {
      logger.warn('Registration denied: Not an employee, manager, or admin', {
        userId: employee.id,
        userRole: employee.role
      });
      return res.status(403).json({ message: 'Only employee, manager, or admin can use this endpoint' });
    }

    // Check if employee can register patients
    if (!canRegister['Patient']?.includes('Employee')) {
      logger.warn('Registration denied: Employee cannot register patients', {
        employeeId: employee.id,
        employeeRole: employee.role
      });
      return res.status(403).json({ message: 'Employee cannot register patients' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      logger.warn('Registration failed: User already exists', { email });
      return res.status(409).json({ message: 'User already exists' });
    }

    // Create patient user
    const user = new User({
      name, email, password,
      phone, address, dateOfBirth, gender,
      role: 'Patient'
    });

    await user.save();

    // Create audit log
    await AuditLog.create({
      action: 'REGISTER_PATIENT',
      actorId: employee.id,
      targetId: user._id,
      targetType: 'User',
      details: `${employee.role} registered patient: ${user.name}`,
      ipAddress: req.ip
    });

    logger.info('Patient registered successfully by employee', {
      employeeId: employee.id,
      employeeRole: employee.role,
      patientId: user._id
    });

    res.status(201).json({
      success: true,
      message: 'Patient registered successfully',
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: 'Patient',
        dateOfBirth: user.dateOfBirth,
        gender: user.gender
      }
    });
  } catch (err) {
    logger.error('Patient registration failed by employee', { 
      error: err.message,
      employeeId: employee.id,
      employeeRole: employee.role
    });
    res.status(500).json({ 
      success: false,
      message: 'Patient registration failed',
      error: err.message 
    });
  }
};

/**
 * Register multiple patients at once (Employee, Manager, Admin)
 * @route POST /api/employee/register/patients/bulk
 * @access Private (Employee, Manager, Admin)
 */
exports.registerPatientsBulk = async (req, res) => {
  const employee = req.user;
  const patients = req.body.patients; // Array of patient objects

  try {
    // Verify employee, manager, or admin is making the request
    if (employee.role !== 'Employee' && employee.role !== 'Manager' && employee.role !== 'Admin') {
      return res.status(403).json({ message: 'Only employee, manager, or admin can use this endpoint' });
    }

    if (!Array.isArray(patients) || patients.length === 0) {
      return res.status(400).json({ message: 'Patients array is required and cannot be empty' });
    }

    const results = {
      successful: [],
      failed: []
    };

    // Process each patient
    for (const patientData of patients) {
      try {
        const { 
          name, email, password,
          phone, address, dateOfBirth, gender
        } = patientData;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
          results.failed.push({
            email,
            error: 'User already exists'
          });
          continue;
        }

        // Create patient user
        const user = new User({
          name, email, password,
          phone, address, dateOfBirth, gender,
          role: 'Patient'
        });

        await user.save();

        // Create audit log for each patient
        await AuditLog.create({
          action: 'REGISTER_PATIENT_BULK',
          actorId: employee.id,
          targetId: user._id,
          targetType: 'User',
          details: `${employee.role} registered patient: ${user.name} (bulk registration)`,
          ipAddress: req.ip
        });

        results.successful.push({
          id: user._id,
          name: user.name,
          email: user.email,
          role: 'Patient'
        });

      } catch (err) {
        results.failed.push({
          email: patientData.email,
          error: err.message
        });
      }
    }

    logger.info('Bulk patient registration completed by employee', {
      employeeId: employee.id,
      employeeRole: employee.role,
      successful: results.successful.length,
      failed: results.failed.length
    });

    res.status(201).json({
      success: true,
      message: 'Bulk patient registration completed',
      data: results
    });
  } catch (err) {
    logger.error('Bulk patient registration failed by employee', { 
      error: err.message,
      employeeId: employee.id,
      employeeRole: employee.role
    });
    res.status(500).json({ 
      success: false,
      message: 'Bulk registration failed',
      error: err.message 
    });
  }
};
