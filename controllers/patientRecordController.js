/**
 * Patient Record Controller
 * Refactored to use OpenBao Transit Engine for all encryption operations
 */

const PatientRecord = require('../models/PatientRecord');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const cryptoService = require('../services/openbaoCryptoService');
const keyExchangeService = require('../services/keyExchangeService');
const {
  canCreateRecord,
  canViewOwnRecord,
  canViewRecordById,
  canViewAllRecords,
} = require('../utils/recordAccessRoles');

const { loadAESKey } = require('../middlewares/loadAESKey');
const transitEncryptMiddleware = require('../middlewares/transitEncryptMiddleware');
const transitDecryptMiddleware = require('../middlewares/transitDecryptMiddleware');

/**
 * Create a new patient record
 * Flow: Frontend sends encrypted data → Decrypt → Encrypt for DB → Store
 */
exports.createRecord = [
  // Step 1: Unwrap frontend's AES key
  loadAESKey,
  
  // Step 2: Decrypt fields that frontend encrypted
  transitDecryptMiddleware(['diagnosis', 'notes', 'medications']),
  
  // Step 3: Validate and prepare for DB encryption
  async (req, res, next) => {
    const { role, id: creatorId } = req.user;
    const { patient, diagnosis, notes, medications, visitDate } = req.body;
    const frontendPublicKeyBase64 = req.headers['x-client-public-key'];

    try {
      // Validate permissions
      if (!canCreateRecord(role)) {
        return res.status(403).json({ 
          message: 'Only providers and managers can create patient records' 
        });
      }

      // Validate required fields
      if (!diagnosis || !notes || !medications || !visitDate) {
        return res.status(400).json({ message: 'All fields are required' });
      }

      // Validate visit date (must be today)
      const today = new Date();
      const tzOffsetMs = today.getTimezoneOffset() * 60 * 1000;
      const localISO = new Date(today.getTime() - tzOffsetMs).toISOString().split('T')[0];

      if (visitDate !== localISO) {
        return res.status(400).json({ message: 'Can only create records for today' });
      }

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
      console.error('Pre-validation error in createRecord:', error);
      return res.status(500).json({ 
        message: 'Validation failed', 
        error: error.message 
      });
    }
  },

  // Step 4: Encrypt fields for database storage using OpenBao
  transitEncryptMiddleware(['diagnosis', 'notes', 'medications']),

  // Step 5: Save to database
  async (req, res) => {
    const { patient, diagnosis, notes, medications, visitDate } = req.body;
    const { id: creatorId } = req.user;
    const frontendPublicKey = req.frontendPublicKey;

    try {
      // Generate data key for this record
      const dataKey = await cryptoService.generateDataKey();
      
      // Wrap the data key for frontend (if public key provided)
      let encryptedDbAESKey;
      if (frontendPublicKey) {
        const wrapped = await keyExchangeService.wrapAESKeyForFrontend(dataKey.plaintextKey);
        encryptedDbAESKey = wrapped.wrappedKey;
      } else {
        // Fallback: use encrypted data key from OpenBao
        encryptedDbAESKey = dataKey.ciphertextKey;
      }

      // Create record with encrypted fields
      const record = await PatientRecord.create({
        patient,
        diagnosis, // Already encrypted by middleware
        notes, // Already encrypted by middleware
        medications, // Already encrypted by middleware
        visitDate,
        createdBy: creatorId,
        encryptedAesKey: encryptedDbAESKey,
        transitKeyVersion: dataKey.keyVersion,
        encryptionMetadata: {
          algorithm: 'aes256-gcm96',
          keyId: 'ehr-aes-master',
          encryptedAt: new Date()
        }
      });

      // Audit log
      await AuditLog.create({
        action: 'CREATE_RECORD',
        actorId: creatorId,
        targetId: record._id,
        targetType: 'PatientRecord',
        details: `Created record for patient ${patient}`,
      });

      return res.status(201).json({
        message: 'Record created successfully',
        recordId: record._id,
        record: {
          patient: record.patient,
          diagnosis: record.diagnosis,
          notes: record.notes,
          medications: record.medications,
          visitDate: record.visitDate,
          encryptedAesKey: record.encryptedAesKey,
          transitKeyVersion: record.transitKeyVersion
        }
      });
    } catch (error) {
      console.error('Error saving record:', error);
      return res.status(500).json({ 
        message: 'Record creation failed', 
        error: error.message 
      });
    }
  }
];

/**
 * Get all patient records (Manager only)
 */
exports.getAllRecords = async (req, res) => {
  const { role } = req.user;
  
  try {
    if (!canViewAllRecords(role)) {
      return res.status(403).json({ 
        message: 'Only managers can view all records' 
      });
    }

    const records = await PatientRecord.find().populate({ path: 'patient' });
    
    if (!records || records.length === 0) {
      return res.status(404).json({ message: 'No records found' });
    }

    // Return encrypted records (frontend will decrypt)
    const responseRecords = records.map(record => ({
      id: record._id,
      patient: record.patient,
      diagnosis: record.diagnosis, // Encrypted
      notes: record.notes, // Encrypted
      medications: record.medications, // Encrypted
      visitDate: record.visitDate,
      createdBy: record.createdBy,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      encryptedAesKey: record.encryptedAesKey,
      transitKeyVersion: record.transitKeyVersion
    }));

    // Audit log
    await AuditLog.create({
      action: 'VIEW_ALL_RECORDS',
      actorId: req.user.id,
      targetType: 'PatientRecord',
      details: 'Manager viewed all patient records',
    });

    res.status(200).json({
      message: 'All records retrieved successfully',
      records: responseRecords
    });
  } catch (error) {
    console.error('Error retrieving all records:', error);
    return res.status(500).json({ 
      message: 'Failed to retrieve all records', 
      error: error.message 
    });
  }
};

/**
 * Get patient's own records
 */
exports.getMyRecord = async (req, res) => {
  const { role, id: requesterId } = req.user;
  
  try {
    const records = await PatientRecord.find({ patient: requesterId })
      .populate('patient');
    
    if (!records || records.length === 0) {
      return res.status(404).json({ 
        message: 'No records found for this patient' 
      });
    }

    if (role !== 'Patient') {
      return res.status(403).json({ 
        message: 'Only patients can view their own records' 
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
      notes: record.notes, // Encrypted
      medications: record.medications, // Encrypted
      visitDate: record.visitDate,
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

    res.status(200).json({
      message: 'Records retrieved successfully',
      records: responseRecords
    });
  } catch (error) {
    console.error('Error retrieving patient records:', error);
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
      notes: record.notes, // Encrypted
      medications: record.medications, // Encrypted
      visitDate: record.visitDate,
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

    res.status(200).json({
      message: 'Record retrieved successfully',
      record: responseRecord
    });
  } catch (error) {
    console.error('Error retrieving record by ID:', error);
    return res.status(500).json({ 
      message: 'Failed to retrieve record', 
      error: error.message 
    });
  }
};
