/**
 * Patient Record Controller
 * Refactored to use OpenBao Transit Engine for all encryption operations
 */

const PatientRecord = require('../models/PatientRecord');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const cryptoService = require('../services/openbaoCryptoService');
const keyExchangeService = require('../services/keyExchangeService');
const logger = require('../config/logger');
const {
  canCreateRecord,
  canViewOwnRecord,
  canViewRecordById,
  canViewAllRecords,
} = require('../utils/recordAccessRoles');

const { loadAESKey } = require('../middlewares/loadAESKey');
const transitEncryptMiddleware = require('../middlewares/transitEncryptMiddleware');
const frontendDecryptMiddleware = require('../middlewares/frontendDecryptMiddleware');

/**
 * Parse date string in dd-mm-yyyy Hr:min format
 * @param {string} dateStr - Date string in format "dd-mm-yyyy HH:MM"
 * @returns {Date} Parsed Date object
 */
const parseVisitDate = (dateStr) => {
  const [datePart, timePart] = dateStr.split(' ');
  const [day, month, year] = datePart.split('-').map(Number);
  const [hour, minute] = timePart ? timePart.split(':').map(Number) : [0, 0];
  
  // Note: month is 0-indexed in JavaScript Date
  return new Date(year, month - 1, day, hour, minute);
};

/**
 * Compare only date portion (ignoring time)
 * @param {Date} date1 - First date
 * @param {Date} date2 - Second date
 * @returns {boolean} True if dates are the same day
 */
const isSameDate = (date1, date2) => {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
};

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
 * Create a new patient record
 * Flow: Frontend sends encrypted data → Decrypt → Encrypt for DB → Store
 */
exports.createRecord = [
  // Step 1: Unwrap frontend's AES key
  loadAESKey,
  
  // Step 2: Decrypt fields that frontend encrypted using frontend AES key
  frontendDecryptMiddleware(['diagnosis', 'treatment', 'notes', 'medications']),
  
  // Step 3: Validate and prepare for DB encryption
  async (req, res, next) => {
    const { role, id: creatorId } = req.user;
    const { patient, diagnosis, treatment, notes, medications, visitDate } = req.body;
    const frontendPublicKeyBase64 = req.headers['x-client-public-key'];

    try {
      // Validate permissions
      if (!canCreateRecord(role)) {
        return res.status(403).json({ 
          message: 'Only providers can create patient records' 
        });
      }

      // Validate required fields
      if (!diagnosis || !treatment || !notes || !medications || !visitDate) {
        return res.status(400).json({ message: 'All fields are required' });
      }

      // Validate visit date format and ensure it's today
      let visitDateObj;
      try {
        visitDateObj = parseVisitDate(visitDate);
        
        // Validate date components
        if (isNaN(visitDateObj.getTime())) {
          return res.status(400).json({ 
            message: 'Invalid date format. Use dd-mm-yyyy HH:MM format (e.g., 23-12-2025 14:30)' 
          });
        }
      } catch (error) {
        return res.status(400).json({ 
          message: 'Invalid date format. Use dd-mm-yyyy HH:MM format (e.g., 23-12-2025 14:30)' 
        });
      }

      // Check if visit date is today
      const today = new Date();
      if (!isSameDate(visitDateObj, today)) {
        return res.status(400).json({ 
          message: 'Can only create records for today. Today is ' + formatDate(today) 
        });
      }

      // Store parsed date object for use in save middleware
      req.parsedVisitDate = visitDateObj;

      // Validate provider assignment
      if (role === 'Provider') {
        const isAssigned = await User.exists({
          _id: creatorId,
          assignedPatients: patient
        });

        if (!isAssigned) {
          return res.status(403).json({ 
            message: 'Provider can only create records for assigned patients' 
          });
        }
      }

      // Store frontend public key for later use
      if (frontendPublicKeyBase64) {
        req.frontendPublicKey = Buffer.from(frontendPublicKeyBase64, 'base64')
          .toString('utf8')
          .replace(/\r?\n/g, '\n');
      }

      next();
    } catch (error) {
      logger.error('Pre-validation error in createRecord', { 
        error: error.message,
        userId: req.user.id
      });
      return res.status(500).json({ 
        message: 'Validation failed', 
        error: error.message 
      });
    }
  },

  // Step 4: Encrypt fields for database storage using OpenBao
  transitEncryptMiddleware(['diagnosis', 'treatment', 'notes', 'medications']),

  // Step 5: Save to database
  async (req, res) => {
    const { patient, diagnosis, treatment, notes, medications, visitDate } = req.body;
    const { id: creatorId } = req.user;
    const frontendPublicKey = req.frontendPublicKey;

    try {
      // Generate data key for this record (backend's AES key)
      const dataKey = await cryptoService.generateDataKey();
      
      // Wrap the backend's AES key for frontend (if frontend public key provided)
      let encryptedDbAESKey;
      let frontendPublicKeyStored = null;
      
      if (frontendPublicKey) {
        // Use the new method to wrap backend's AES key with frontend's RSA public key
        const wrapped = await keyExchangeService.wrapBackendAESKeyForFrontend(
          dataKey.plaintextKey,
          frontendPublicKey
        );
        encryptedDbAESKey = wrapped.wrappedKey;
        frontendPublicKeyStored = frontendPublicKey;
      } else {
        // Fallback: use encrypted data key from OpenBao
        encryptedDbAESKey = dataKey.ciphertextKey;
      }

      // Create record with encrypted fields
      const recordData = {
        patient,
        diagnosis, // Already encrypted by middleware (with backend's AES key)
        notes, // Already encrypted by middleware (with backend's AES key)
        medications, // Already encrypted by middleware (with backend's AES key)
        visitDate: req.parsedVisitDate, // Use parsed Date object
        createdBy: creatorId,
        encryptedAesKey: encryptedDbAESKey,
        transitKeyVersion: dataKey.keyVersion,
        encryptionMetadata: {
          algorithm: 'aes256-gcm96',
          keyId: 'ehr-aes-master-backend',
          encryptedAt: new Date()
        }
      };
      
      // Store frontend's RSA public key if provided
      if (frontendPublicKeyStored) {
        recordData.frontendPublicKey = frontendPublicKeyStored;
      }
      
      const record = await PatientRecord.create(recordData);

      // Audit log
      await AuditLog.create({
        action: 'CREATE_RECORD',
        actorId: creatorId,
        targetId: record._id,
        targetType: 'PatientRecord',
        details: `Created record for patient ${patient}`,
      });

      logger.info('Record created successfully', {
        recordId: record._id,
        creatorId: creatorId,
        patientId: patient
      });

      const responseRecord = {
        patient: record.patient,
        diagnosis: record.diagnosis,
        treatment: record.treatment,
        notes: record.notes,
        medications: record.medications,
        visitDate: formatDate(record.visitDate),
        encryptedAesKey: record.encryptedAesKey,
        transitKeyVersion: record.transitKeyVersion
      };
      
      // Include frontend public key in response if stored
      if (record.frontendPublicKey) {
        responseRecord.frontendPublicKey = record.frontendPublicKey;
      }
      
      return res.status(201).json({
        message: 'Record created successfully',
        recordId: record._id,
        record: responseRecord
      });
    } catch (error) {
      logger.error('Error saving record', { 
        error: error.message,
        userId: req.user?.id,
        patientId: req.body.patient
      });
      return res.status(500).json({ 
        message: 'Record creation failed', 
        error: error.message 
      });
    }
  }
];

/**
 * Get all patient records (NO ONE can view all records)
 */
exports.getAllRecords = async (req, res) => {
  // No one can view all records
  return res.status(403).json({ 
    message: 'Access denied. No role has permission to view all records.' 
  });
};

/**
 * Get patient's own records
 */
exports.getMyRecord = async (req, res) => {
  const { role, id: requesterId } = req.user;
  
  try {
    // Check role FIRST before querying database
    if (role !== 'Patient') {
      return res.status(403).json({ 
        message: 'Only patients can view their own records' 
      });
    }

    const records = await PatientRecord.find({ patient: requesterId })
      .populate('patient');
    
    if (!records || records.length === 0) {
      return res.status(404).json({ 
        message: 'No records found for this patient' 
      });
    }

    // Verify access permissions
    const allAllowed = records.every(record =>
      canViewOwnRecord(role, requesterId, record)
    );

    if (!allAllowed) {
      return res.status(403).json({ 
        message: 'Not authorized to view this record' 
      });
    }

    const responseRecords = records.map(record => ({
      _id: record._id,
      patient: record.patient,
      diagnosis: record.diagnosis, // Encrypted
      treatment: record.treatment, // Encrypted
      notes: record.notes, // Encrypted
      medications: record.medications, // Encrypted
      visitDate: formatDate(record.visitDate),
      encryptedAesKey: record.encryptedAesKey,
      transitKeyVersion: record.transitKeyVersion
    }));

    // Audit log
    await AuditLog.create({
      action: 'VIEW_RECORDS',
      actorId: req.user.id,
      targetType: 'PatientRecord',
      details: `Viewed all records for patient ${req.user.id}`,
    });

    logger.info('Patient records retrieved', {
      patientId: requesterId,
      recordCount: responseRecords.length
    });

    res.status(200).json({
      message: 'Records retrieved successfully',
      records: responseRecords
    });
  } catch (error) {
    logger.error('Error retrieving patient records', { 
      error: error.message,
      userId: requesterId
    });
    return res.status(500).json({ 
      message: 'Failed to retrieve patient records', 
      error: error.message 
    });
  }
};

/**
 * Get a specific patient record by ID
 */
exports.getRecordById = async (req, res) => {
  const { role, id: requesterId } = req.user;
  
  try {
    const record = await PatientRecord.findById(req.params.id)
      .populate({ path: 'patient', select: 'assignedProviderId' });

    if (!record) {
      return res.status(404).json({ message: 'Record not found' });
    }

    // Verify access permissions
    const allowed = canViewRecordById(role, requesterId, record);
    if (!allowed) {
      return res.status(403).json({ 
        message: 'Not authorized to view this record' 
      });
    }

    const responseRecord = {
      _id: record._id,
      patient: record.patient,
      diagnosis: record.diagnosis, // Encrypted
      treatment: record.treatment, // Encrypted
      notes: record.notes, // Encrypted
      medications: record.medications, // Encrypted
      visitDate: formatDate(record.visitDate),
      encryptedAesKey: record.encryptedAesKey,
      transitKeyVersion: record.transitKeyVersion
    };

    // Audit log
    await AuditLog.create({
      action: 'VIEW_RECORD',
      actorId: req.user.id,
      targetId: record._id,
      targetType: 'PatientRecord',
      details: `Viewed record for patient ${record.patient?._id}`,
    });

    logger.info('Record retrieved by ID', {
      recordId: req.params.id,
      userId: requesterId
    });

    res.status(200).json({
      message: 'Record retrieved successfully',
      record: responseRecord
    });
  } catch (error) {
    logger.error('Error retrieving record by ID', { 
      error: error.message,
      recordId: req.params.id,
      userId: requesterId
    });
    return res.status(500).json({ 
      message: 'Failed to retrieve record', 
      error: error.message 
    });
  }
};

/**
 * Get records for provider's assigned patients
 * @route GET /api/patient-records/provider/assigned
 * @access Provider only
 */
exports.getAssignedPatientRecords = async (req, res) => {
  const { role, id: providerId } = req.user;
  
  if (role !== 'Provider') {
    return res.status(403).json({ 
      message: 'Only providers can view assigned patient records' 
    });
  }
  
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
    }).populate({ path: 'patient' });
    
    // Return encrypted records
    const responseRecords = records.map(record => ({
      id: record._id,
      patient: record.patient,
      diagnosis: record.diagnosis,
      treatment: record.treatment,
      notes: record.notes,
      medications: record.medications,
      visitDate: formatDate(record.visitDate),
      encryptedAesKey: record.encryptedAesKey,
      transitKeyVersion: record.transitKeyVersion
    }));
    
    // Audit log
    await AuditLog.create({
      action: 'VIEW_ASSIGNED_RECORDS',
      actorId: providerId,
      targetType: 'PatientRecord',
      details: `Provider viewed assigned patient records`,
    });

    logger.info('Assigned patient records retrieved', {
      providerId: providerId,
      recordCount: responseRecords.length
    });

    res.status(200).json({
      message: 'Assigned patient records retrieved successfully',
      records: responseRecords
    });
  } catch (error) {
    logger.error('Error retrieving assigned patient records', { 
      error: error.message,
      providerId 
    });
    res.status(500).json({ 
      message: 'Failed to retrieve assigned patient records',
      error: error.message 
    });
  }
};
