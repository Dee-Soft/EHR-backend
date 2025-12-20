const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const logger = require('../config/logger');

/**
 * Create a new patient-provider assignment
 * @access Employee, Manager, Admin
 */
exports.createAssignment = async (req, res) => {
  const { providerId, patientId } = req.body;
  const actorId = req.user.id;
  const actorRole = req.user.role;

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
      logger.warn('Invalid provider for assignment', {
        actorId,
        actorRole,
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
      logger.warn('Invalid patient for assignment', {
        actorId,
        actorRole,
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
      action: 'CREATE_ASSIGNMENT',
      actorId: actorId,
      targetId: patientId,
      targetType: 'Assignment',
      details: `Assigned patient ${patient.name} to provider ${provider.name} by ${actorRole}`,
      ipAddress: req.ip
    });

    logger.info('Assignment created successfully', {
      actorId,
      actorRole,
      providerId,
      patientId,
      wasAlreadyAssigned: isAlreadyAssigned && hasSameProvider
    });

    res.status(201).json({ 
      success: true,
      message: 'Assignment created successfully',
      data: {
        assignmentId: `${providerId}-${patientId}`,
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
    logger.error('Failed to create assignment', {
      error: error.message,
      actorId,
      providerId,
      patientId
    });
    res.status(500).json({ 
      message: 'Failed to create assignment',
      error: error.message 
    });
  }
};

/**
 * Update an existing assignment
 * @access Employee, Manager, Admin
 */
exports.updateAssignment = async (req, res) => {
  const { assignmentId } = req.params;
  const { newProviderId } = req.body;
  const actorId = req.user.id;
  const actorRole = req.user.role;

  try {
    // Parse assignment ID (format: providerId-patientId)
    const [oldProviderId, patientId] = assignmentId.split('-');
    
    if (!oldProviderId || !patientId) {
      return res.status(400).json({ 
        message: 'Invalid assignment ID format' 
      });
    }

    if (!newProviderId) {
      return res.status(400).json({ 
        message: 'New provider ID is required' 
      });
    }

    // Get all involved users
    const oldProvider = await User.findById(oldProviderId);
    const newProvider = await User.findById(newProviderId);
    const patient = await User.findById(patientId);

    // Validate old provider
    if (!oldProvider || oldProvider.role !== 'Provider') {
      return res.status(400).json({ 
        message: 'Original provider not found or invalid role' 
      });
    }

    // Validate new provider
    if (!newProvider || newProvider.role !== 'Provider') {
      return res.status(400).json({ 
        message: 'New provider not found or invalid role' 
      });
    }

    // Validate patient
    if (!patient || patient.role !== 'Patient') {
      return res.status(400).json({ 
        message: 'Patient not found or invalid role' 
      });
    }

    // Check if patient is actually assigned to old provider
    const isAssignedToOld = oldProvider.assignedPatients.includes(patientId);
    const hasOldProvider = patient.assignedProviderId?.toString() === oldProviderId;

    if (!isAssignedToOld || !hasOldProvider) {
      return res.status(400).json({ 
        message: 'Patient is not assigned to the original provider' 
      });
    }

    // Check if already assigned to new provider
    const isAlreadyAssignedToNew = newProvider.assignedPatients.includes(patientId);
    
    if (isAlreadyAssignedToNew && patient.assignedProviderId?.toString() === newProviderId) {
      return res.status(200).json({ 
        message: 'Patient is already assigned to the new provider' 
      });
    }

    // Remove from old provider
    oldProvider.assignedPatients = oldProvider.assignedPatients.filter(
      id => id.toString() !== patientId
    );
    await oldProvider.save();

    // Add to new provider if not already there
    if (!isAlreadyAssignedToNew) {
      newProvider.assignedPatients.push(patientId);
      await newProvider.save();
    }

    // Update patient's assigned provider
    patient.assignedProviderId = newProviderId;
    await patient.save();

    // Create audit log
    await AuditLog.create({
      action: 'UPDATE_ASSIGNMENT',
      actorId: actorId,
      targetId: patientId,
      targetType: 'Assignment',
      details: `Reassigned patient ${patient.name} from provider ${oldProvider.name} to ${newProvider.name} by ${actorRole}`,
      ipAddress: req.ip
    });

    logger.info('Assignment updated successfully', {
      actorId,
      actorRole,
      oldProviderId,
      newProviderId,
      patientId
    });

    res.status(200).json({ 
      success: true,
      message: 'Assignment updated successfully',
      data: {
        assignmentId: `${newProviderId}-${patientId}`,
        oldProvider: {
          id: oldProvider._id,
          name: oldProvider.name,
          assignedPatients: oldProvider.assignedPatients
        },
        newProvider: {
          id: newProvider._id,
          name: newProvider.name,
          assignedPatients: newProvider.assignedPatients
        },
        patient: {
          id: patient._id,
          name: patient.name,
          assignedProviderId: patient.assignedProviderId
        }
      }
    });
  } catch (error) {
    logger.error('Failed to update assignment', {
      error: error.message,
      actorId,
      assignmentId
    });
    res.status(500).json({ 
      message: 'Failed to update assignment',
      error: error.message 
    });
  }
};

/**
 * Delete an assignment (unassign patient from provider)
 * @access Employee, Manager, Admin
 */
exports.deleteAssignment = async (req, res) => {
  const { assignmentId } = req.params;
  const actorId = req.user.id;
  const actorRole = req.user.role;

  try {
    // Parse assignment ID (format: providerId-patientId)
    const [providerId, patientId] = assignmentId.split('-');
    
    if (!providerId || !patientId) {
      return res.status(400).json({ 
        message: 'Invalid assignment ID format' 
      });
    }

    // Get provider and patient
    const provider = await User.findById(providerId);
    const patient = await User.findById(patientId);

    // Validate provider
    if (!provider || provider.role !== 'Provider') {
      return res.status(400).json({ 
        message: 'Provider not found or invalid role' 
      });
    }

    // Validate patient
    if (!patient || patient.role !== 'Patient') {
      return res.status(400).json({ 
        message: 'Patient not found or invalid role' 
      });
    }

    // Check if actually assigned
    const isAssigned = provider.assignedPatients.includes(patientId);
    const hasProvider = patient.assignedProviderId?.toString() === providerId;

    if (!isAssigned || !hasProvider) {
      return res.status(400).json({ 
        message: 'Patient is not assigned to this provider' 
      });
    }

    // Remove from provider's assigned list
    provider.assignedPatients = provider.assignedPatients.filter(
      id => id.toString() !== patientId
    );
    await provider.save();

    // Remove provider from patient
    patient.assignedProviderId = null;
    await patient.save();

    // Create audit log
    await AuditLog.create({
      action: 'DELETE_ASSIGNMENT',
      actorId: actorId,
      targetId: patientId,
      targetType: 'Assignment',
      details: `Unassigned patient ${patient.name} from provider ${provider.name} by ${actorRole}`,
      ipAddress: req.ip
    });

    logger.info('Assignment deleted successfully', {
      actorId,
      actorRole,
      providerId,
      patientId
    });

    res.status(200).json({ 
      success: true,
      message: 'Assignment deleted successfully',
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
    logger.error('Failed to delete assignment', {
      error: error.message,
      actorId,
      assignmentId
    });
    res.status(500).json({ 
      message: 'Failed to delete assignment',
      error: error.message 
    });
  }
};

/**
 * Get assignment by ID
 * @access Employee, Manager, Admin
 */
exports.getAssignmentById = async (req, res) => {
  const { assignmentId } = req.params;
  const actorId = req.user.id;

  try {
    // Parse assignment ID (format: providerId-patientId)
    const [providerId, patientId] = assignmentId.split('-');
    
    if (!providerId || !patientId) {
      return res.status(400).json({ 
        message: 'Invalid assignment ID format' 
      });
    }

    // Get provider and patient
    const provider = await User.findById(providerId)
      .select('name email providerId assignedPatients')
      .lean();
    
    const patient = await User.findById(patientId)
      .select('name email dateOfBirth gender assignedProviderId')
      .lean();

    // Validate provider
    if (!provider || provider.role !== 'Provider') {
      return res.status(404).json({ 
        message: 'Provider not found' 
      });
    }

    // Validate patient
    if (!patient || patient.role !== 'Patient') {
      return res.status(404).json({ 
        message: 'Patient not found' 
      });
    }

    // Check if actually assigned
    const isAssigned = provider.assignedPatients?.some(
      id => id.toString() === patientId
    );
    const hasProvider = patient.assignedProviderId?.toString() === providerId;

    if (!isAssigned || !hasProvider) {
      return res.status(404).json({ 
        message: 'Assignment not found' 
      });
    }

    const assignment = {
      id: assignmentId,
      provider: {
        id: provider._id,
        name: provider.name,
        email: provider.email,
        providerId: provider.providerId
      },
      patient: {
        id: patient._id,
        name: patient.name,
        email: patient.email,
        dateOfBirth: patient.dateOfBirth,
        gender: patient.gender
      },
      assignedAt: patient.updatedAt, // Use patient's last update as assignment time
      isValid: isAssigned && hasProvider
    };

    logger.info('Assignment retrieved by ID', {
      actorId,
      assignmentId
    });

    res.status(200).json({
      success: true,
      data: assignment
    });
  } catch (error) {
    logger.error('Failed to retrieve assignment', {
      error: error.message,
      actorId,
      assignmentId
    });
    res.status(500).json({ 
      message: 'Failed to retrieve assignment',
      error: error.message 
    });
  }
};
