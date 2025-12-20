const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const logger = require('../config/logger');

/**
 * Get all available providers
 * @route GET /api/employees/providers
 * @access Employee, Manager, Admin
 */
exports.getAllProviders = async (req, res) => {
  try {
    const providers = await User.find({ role: 'Provider' })
      .select('-password -assignedPatients')
      .lean();

    logger.info('Providers retrieved by employee', {
      employeeId: req.user.id,
      providerCount: providers.length
    });

    res.status(200).json({
      success: true,
      count: providers.length,
      data: providers
    });
  } catch (error) {
    logger.error('Failed to retrieve providers', {
      error: error.message,
      employeeId: req.user.id
    });
    res.status(500).json({ 
      message: 'Failed to retrieve providers',
      error: error.message 
    });
  }
};

/**
 * Get all patients
 * @route GET /api/employees/patients
 * @access Employee, Manager, Admin
 */
exports.getAllPatients = async (req, res) => {
  try {
    const patients = await User.find({ role: 'Patient' })
      .select('-password')
      .populate('assignedProviderId', 'name email providerId')
      .lean();

    logger.info('Patients retrieved by employee', {
      employeeId: req.user.id,
      patientCount: patients.length
    });

    res.status(200).json({
      success: true,
      count: patients.length,
      data: patients
    });
  } catch (error) {
    logger.error('Failed to retrieve patients', {
      error: error.message,
      employeeId: req.user.id
    });
    res.status(500).json({ 
      message: 'Failed to retrieve patients',
      error: error.message 
    });
  }
};

/**
 * Get all patient-provider assignments
 * @route GET /api/employees/assignments
 * @access Employee, Manager, Admin
 */
exports.getAssignments = async (req, res) => {
  try {
    // Get all providers with their assigned patients
    const providers = await User.find({ role: 'Provider' })
      .select('name email providerId assignedPatients')
      .populate('assignedPatients', 'name email dateOfBirth gender')
      .lean();

    // Get all patients with their assigned providers
    const patients = await User.find({ role: 'Patient', assignedProviderId: { $ne: null } })
      .select('name email dateOfBirth gender assignedProviderId')
      .populate('assignedProviderId', 'name email providerId')
      .lean();

    const assignments = {
      providers: providers.map(provider => ({
        providerId: provider._id,
        name: provider.name,
        email: provider.email,
        providerId: provider.providerId,
        assignedPatients: provider.assignedPatients || []
      })),
      patients: patients.map(patient => ({
        patientId: patient._id,
        name: patient.name,
        email: patient.email,
        assignedProvider: patient.assignedProviderId
      }))
    };

    logger.info('Assignments retrieved by employee', {
      employeeId: req.user.id,
      providerCount: assignments.providers.length,
      patientCount: assignments.patients.length
    });

    res.status(200).json({
      success: true,
      data: assignments
    });
  } catch (error) {
    logger.error('Failed to retrieve assignments', {
      error: error.message,
      employeeId: req.user.id
    });
    res.status(500).json({ 
      message: 'Failed to retrieve assignments',
      error: error.message 
    });
  }
};

/**
 * Assign a patient to a provider
 * @route POST /api/employees/assignments
 * @access Employee, Manager, Admin
 */
exports.assignPatientToProvider = async (req, res) => {
  const { providerId, patientId } = req.body;
  const employeeId = req.user.id;
  const employeeRole = req.user.role;

  try {
    // Validate input
    if (!providerId || !patientId) {
      return res.status(400).json({ 
        message: 'Provider ID and Patient ID are required' 
      });
    }

    // Get provider and patient
    const provider = await User.findById(providerId);
    const patient = await User.findById(patientId);

    // Validate provider
    if (!provider || provider.role !== 'Provider') {
      logger.warn('Invalid provider assignment attempt', {
        employeeId,
        providerId,
        providerExists: !!provider,
        providerRole: provider?.role
      });
      return res.status(400).json({ 
        message: 'Provider not found or invalid role' 
      });
    }

    // Validate patient
    if (!patient || patient.role !== 'Patient') {
      logger.warn('Invalid patient assignment attempt', {
        employeeId,
        patientId,
        patientExists: !!patient,
        patientRole: patient?.role
      });
      return res.status(400).json({ 
        message: 'Patient not found or invalid role' 
      });
    }

    // Check if already assigned
    const isAlreadyAssigned = provider.assignedPatients.includes(patientId);
    const hasSameProvider = patient.assignedProviderId?.toString() === providerId;

    if (isAlreadyAssigned && hasSameProvider) {
      return res.status(200).json({ 
        message: 'Patient is already assigned to this provider' 
      });
    }

    // Add patient to provider's assigned list if not already there
    if (!isAlreadyAssigned) {
      provider.assignedPatients.push(patientId);
      await provider.save();
    }

    // Assign provider to patient if different
    if (!hasSameProvider) {
      patient.assignedProviderId = providerId;
      await patient.save();
    }

    // Create audit log
    await AuditLog.create({
      action: 'ASSIGN_PATIENT',
      actorId: employeeId,
      targetId: patientId,
      targetType: 'User',
      details: `Assigned patient ${patient.name} to provider ${provider.name} by ${employeeRole}`,
      ipAddress: req.ip
    });

    logger.info('Patient assigned to provider successfully', {
      employeeId,
      employeeRole,
      providerId,
      patientId,
      wasAlreadyAssigned: isAlreadyAssigned && hasSameProvider
    });

    res.status(200).json({ 
      success: true,
      message: 'Patient assigned to provider successfully',
      data: {
        provider: {
          id: provider._id,
          name: provider.name,
          assignedPatients: provider.assignedPatients
        },
        patient: {
          id: patient._id,
          name: patient.name,
          assignedProviderId: patient.assignedProviderId
        }
      }
    });
  } catch (error) {
    logger.error('Failed to assign patient to provider', {
      error: error.message,
      employeeId,
      providerId,
      patientId
    });
    res.status(500).json({ 
      message: 'Failed to assign patient to provider',
      error: error.message 
    });
  }
};
