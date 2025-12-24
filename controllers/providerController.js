const User = require('../models/User');
const PatientRecord = require('../models/PatientRecord');
const AuditLog = require('../models/AuditLog');
const logger = require('../config/logger');

/**
 * Format date to dd-mm-yyyy HH:MM format
 * @param {Date} date - Date object to format
 * @returns {string} Formatted date string
 */
const formatDate = (date) => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${day}-${month}-${year} ${hours}:${minutes}`;
};

/**
 * Get provider's assigned patients
 * @route GET /api/providers/assigned-patients
 * @access Provider only
 */
exports.getMyAssignedPatients = async (req, res) => {
  const providerId = req.user.id;

  try {
    const provider = await User.findById(providerId)
      .select('assignedPatients')
      .populate('assignedPatients', 'name email dateOfBirth gender phone address')
      .lean();

    if (!provider) {
      return res.status(404).json({ 
        message: 'Provider not found' 
      });
    }

    const assignedPatients = provider.assignedPatients || [];

    logger.info('Assigned patients retrieved by provider', {
      providerId,
      patientCount: assignedPatients.length
    });

    res.status(200).json({
      success: true,
      count: assignedPatients.length,
      data: assignedPatients
    });
  } catch (error) {
    logger.error('Failed to retrieve assigned patients', {
      error: error.message,
      providerId
    });
    res.status(500).json({ 
      message: 'Failed to retrieve assigned patients',
      error: error.message 
    });
  }
};

/**
 * Get patient records for provider's assigned patients
 * @route GET /api/providers/patient-records
 * @access Provider only
 */
exports.getPatientRecords = async (req, res) => {
  const providerId = req.user.id;

  try {
    // Get provider's assigned patients
    const provider = await User.findById(providerId).select('assignedPatients');
    
    if (!provider || !provider.assignedPatients || provider.assignedPatients.length === 0) {
      return res.status(404).json({ 
        message: 'No patients assigned to this provider' 
      });
    }

    // Get records for assigned patients
    const records = await PatientRecord.find({ 
      patient: { $in: provider.assignedPatients } 
    })
    .populate({
      path: 'patient',
      select: 'name email dateOfBirth gender'
    })
    .sort({ visitDate: -1, createdAt: -1 })
    .lean();

    // Format response with encrypted fields
    const formattedRecords = records.map(record => ({
      id: record._id,
      patient: record.patient,
      diagnosis: record.diagnosis, // Encrypted
      notes: record.notes, // Encrypted
      medications: record.medications, // Encrypted
      visitDate: formatDate(record.visitDate),
      createdAt: formatDate(record.createdAt),
      encryptedAesKey: record.encryptedAesKey,
      transitKeyVersion: record.transitKeyVersion
    }));

    logger.info('Patient records retrieved by provider', {
      providerId,
      recordCount: formattedRecords.length,
      patientCount: provider.assignedPatients.length
    });

    res.status(200).json({
      success: true,
      count: formattedRecords.length,
      data: formattedRecords
    });
  } catch (error) {
    logger.error('Failed to retrieve patient records', {
      error: error.message,
      providerId
    });
    res.status(500).json({ 
      message: 'Failed to retrieve patient records',
      error: error.message 
    });
  }
};

/**
 * Update provider availability status
 * @route PUT /api/providers/availability
 * @access Provider only
 */
exports.updateAvailability = async (req, res) => {
  const providerId = req.user.id;
  const { isAvailable, availabilityNotes } = req.body;

  try {
    const provider = await User.findById(providerId);

    if (!provider) {
      return res.status(404).json({ 
        message: 'Provider not found' 
      });
    }

    // Update availability fields
    const updates = {};
    
    if (isAvailable !== undefined) {
      updates.isAvailable = isAvailable;
    }
    
    if (availabilityNotes !== undefined) {
      updates.availabilityNotes = availabilityNotes;
    }

    // Apply updates
    Object.assign(provider, updates);
    await provider.save();

    // Create audit log
    await AuditLog.create({
      action: 'UPDATE_AVAILABILITY',
      actorId: providerId,
      targetId: providerId,
      targetType: 'User',
      details: `Updated availability: ${isAvailable ? 'Available' : 'Unavailable'} - ${availabilityNotes || 'No notes'}`,
      ipAddress: req.ip
    });

    logger.info('Provider availability updated', {
      providerId,
      isAvailable,
      hasNotes: !!availabilityNotes
    });

    res.status(200).json({
      success: true,
      message: 'Availability updated successfully',
      data: {
        id: provider._id,
        name: provider.name,
        isAvailable: provider.isAvailable,
        availabilityNotes: provider.availabilityNotes,
        updatedAt: formatDate(provider.updatedAt)
      }
    });
  } catch (error) {
    logger.error('Failed to update provider availability', {
      error: error.message,
      providerId
    });
    res.status(500).json({ 
      message: 'Failed to update availability',
      error: error.message 
    });
  }
};

/**
 * Get provider's own profile information
 * @route GET /api/providers/profile
 * @access Provider only
 */
exports.getProviderProfile = async (req, res) => {
  const providerId = req.user.id;

  try {
    const provider = await User.findById(providerId)
      .select('-password')
      .populate('assignedPatients', 'name email dateOfBirth')
      .lean();

    if (!provider) {
      return res.status(404).json({ 
        message: 'Provider not found' 
      });
    }

    // Count assigned patients
    const assignedPatientCount = provider.assignedPatients?.length || 0;

    // Get recent records count
    const recentRecordsCount = await PatientRecord.countDocuments({
      patient: { $in: provider.assignedPatients || [] },
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
    });

    const profile = {
      id: provider._id,
      name: provider.name,
      email: provider.email,
      phone: provider.phone,
      providerId: provider.providerId,
      isAvailable: provider.isAvailable || true,
      availabilityNotes: provider.availabilityNotes,
      assignedPatients: provider.assignedPatients || [],
      stats: {
        assignedPatientCount,
        recentRecordsCount,
        totalRecordsCount: await PatientRecord.countDocuments({
          patient: { $in: provider.assignedPatients || [] }
        })
      },
      createdAt: formatDate(provider.createdAt),
      updatedAt: formatDate(provider.updatedAt)
    };

    logger.info('Provider profile retrieved', {
      providerId,
      assignedPatientCount,
      recentRecordsCount
    });

    res.status(200).json({
      success: true,
      data: profile
    });
  } catch (error) {
    logger.error('Failed to retrieve provider profile', {
      error: error.message,
      providerId
    });
    res.status(500).json({ 
      message: 'Failed to retrieve profile',
      error: error.message 
    });
  }
};
