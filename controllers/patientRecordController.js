const PatientRecord = require('../models/PatientRecord');
const User = require('../models/User');
const { generateAESKey } = require('../helpers/cryptoHelper');
const AuditLog = require('../models/AuditLog');
const {
    canCreateRecord,
    canViewOwnRecord,
    canViewRecordById,
    canViewAllRecords,  
} = require('../utils/recordAccessRoles');

const { encryptWithBackendPubKey, reEncryptWithFrontPubKey} = require('../utils/rsaUtils');
const encryptFieldsAESMiddleware = require('../middlewares/encryptFieldsAESMiddleware');
const decryptFieldsAESMiddleware = require('../middlewares/decryptFieldsAESMiddleware');

const { loadAESKey } = require('../middlewares/loadAESKey');

const { fetchFrontendPublicKey, sendBackendPublicKey } = require('../middlewares/keyExchangeMiddleware');


// Function to create a new patient record
exports.createRecord = [
    sendBackendPublicKey, // Ensure keys are exchanged before processing
    async (req, res, next) => {
        const { role, id: creatorId } = req.user;
        const { patient, diagnosis, notes, medications, visitDate } = req.body;

        try {
            if (!canCreateRecord(role)) {
                return res.status(403).json({ message: 'Only providers and managers can create patient records' });
            }

            if (!diagnosis || !notes || !medications || !visitDate) {
                return res.status(400).json({ message: 'All fields are required' });
            }

            const today = new Date();
            const tzOffsetMs = today.getTimezoneOffset() * 60 * 1000;
            const localISO = new Date(today.getTime() - tzOffsetMs).toISOString().split('T')[0];

            if (visitDate !== localISO) {
                return res.status(400).json({ message: 'Can only create records for today' });
            }

            const isAssigned = await User.exists({
                _id: creatorId,
                assignedPatients: patient
            });

            if (role === 'Provider' && !isAssigned) {
                return res.status(403).json({ message: 'Provider can only create records for assigned patients' });
            }

            // Generate AES key and assign to request
            const aesKey = generateAESKey();
            req.aesKey = aesKey; // So middleware can use it

            // Encrypt AES key with backend's public key
            const encryptedAesKey = encryptWithBackendPubKey(aesKey);
            req.encryptedAesKey = encryptedAesKey; // Save for DB later

            console.log('Generated AES Key and encrypted with backend public key');

            next(); // Proceed to encryption middleware
        } catch (error) {
            console.error('Pre-validation error in createRecord:', error);
            return res.status(500).json({ message: 'Validation failed', error: error.message });
        }
    },

    encryptFieldsAESMiddleware(['diagnosis', 'notes', 'medications']),

    async (req, res) => {
        const { patient, diagnosis, notes, medications, visitDate } = req.body;
        const { id: creatorId } = req.user;

        try {
            // Save encrypted data and AES key to DB
            const record = await PatientRecord.create({
                patient,
                diagnosis,
                notes,
                medications,
                visitDate,
                createdBy: creatorId,
                encryptedAesKey: req.encryptedAesKey,
            });

            console.log('Patient record saved:', record._id);

            await AuditLog.create({
                action: 'CREATE_RECORD',
                actorId: creatorId,
                targetId: record._id,
                targetType: 'PatientRecord',
                details: `Created record for patient ${patient}`,
            });

            return res.status(201).json({
                message: 'Patient record created successfully',
                recordId: record._id,
                encryptedAesKey: req.encryptedAesKey
            });
        } catch (error) {
            console.error('Error saving record:', error);
            return res.status(500).json({ message: 'Record creation failed', error: error.message });
        }
    }
];

// Function to get all patient records
exports.getAllRecords = [
    fetchFrontendPublicKey, // Ensure keys are exchanged before processing
    async (req, res, next) => {
        const { role, id: requesterId } = req.user;
        try {
            if (!canViewAllRecords(role)) {
                return res.status(403).json({ message: 'Only managers can view all records' });
            }

            const records = await PatientRecord.find().populate({ path: 'patient' });
            if (!records || records.length === 0) {
                return res.status(404).json({ message: 'No records found' });
            }

            req.recordsWithKeys = records.map(record => ({
                record,
                aesKey: loadAESKey(record.encryptedAesKey)
            }));

            next();
        } catch (error) {
            console.error('Error pre-processing getAllRecords:', error);
            return res.status(500).json({ message: 'Failed to retrieve records', error: error.message });
        }
    },

    async (req, res, next) => {
        try {
            req.recordsWithKeys.forEach(({ record, aesKey }) => {
                decryptFieldsAESMiddleware(req, ['diagnosis', 'notes', 'medications'], aesKey);
            });
            next();
        } catch (error) {
            console.error('Error decrypting records:', error);
            return res.status(500).json({ message: 'Failed to decrypt records', error: error.message });
        }
    },

    async (req, res) => {
        try {
            const processedRecords = req.recordsWithKeys.map(({ record }) => {
                const decryptedRecord = record.toObject();

                const newAesKey = generateAESKey();
                const newEncryptedAesKey = reEncryptWithFrontPubKey(newAesKey);

                encryptFieldsAESMiddleware(req, ['diagnosis', 'notes', 'medications'], newAesKey);

                return {
                    ...decryptedRecord,
                    diagnosis: req.body.diagnosis,
                    notes: req.body.notes,
                    medications: req.body.medications,
                    encryptedAesKey: newEncryptedAesKey
                };
            });

            await AuditLog.create({
                action: 'VIEW_ALL_RECORDS',
                actorId: req.user.id,
                targetType: 'PatientRecord',
                details: `Manager viewed all patient records`,
            });

            res.status(200).json({
                message: 'All records retrieved and re-encrypted successfully',
                records: processedRecords
            });
        } catch (error) {
            console.error('Error finalizing getAllRecords:', error);
            return res.status(500).json({ message: 'Failed to finalize records response', error: error.message });
        }
    }
];

// Function to get patient's own record
exports.getMyRecord = [
  fetchFrontendPublicKey, // Ensure keys are exchanged before processing
  async (req, res, next) => {
    const { role, id: requesterId } = req.user;
    try {
      const records = await PatientRecord.find({ patient: requesterId }).populate('patient');
      if (!records || records.length === 0) {
        return res.status(404).json({ message: 'No records found for this patient' });
      }

      if (role !== 'Patient') {
        return res.status(403).json({ message: 'Only patients can view their own records' });
      }

      const allAllowed = records.every(record =>
        canViewOwnRecord(role, requesterId, record)
      );

      if (!allAllowed) {
          return res.status(403).json({ message: 'Not authorized to view this record' });
      }

      req.records = records; // Pass records to middleware

      // Decrypt AES keys for each record
      req.recordsWithKeys = records.map(record => {
        const aesKey = loadAESKey(record.encryptedAesKey);
        console.log(`Decrypted AES key for record ${record._id}:`, aesKey);
        return { record, aesKey };
      });

      next(); // Go to decryption middleware
    } catch (error) {
      console.error('Error pre-processing getMyRecord:', error);
      return res.status(500).json({ message: 'Failed to retrieve records', error: error.message });
    }
  },

  async (req, res, next) => {
    try {
      // Decrypt fields for each record
      req.recordsWithKeys.forEach(({ record, aesKey }) => {
        decryptFieldsAESMiddleware(['diagnosis', 'notes', 'medications'], record, aesKey);
      });
      next();
    } catch (error) {
      console.error('Error decrypting fields in getMyRecord:', error);
      return res.status(500).json({ message: 'Failed to decrypt records', error: error.message });
    }
  },

  async (req, res) => {
    try {
      // Prepare re-encrypted records
      const reEncryptedRecords = req.recordsWithKeys.map(({ record }) => {
        const newAesKey = generateAESKey();
        const newEncryptedAesKey = reEncryptWithFrontPubKey(newAesKey);

        console.log(`Re-encrypted AES key for record ${record._id}:`, newEncryptedAesKey);

        const reEncryptedFields = encryptFieldsAESMiddleware(['diagnosis', 'notes', 'medications'], record, newAesKey);

        return {
          ...record.toObject(),
          ...reEncryptedFields,
          encryptedAesKey: newEncryptedAesKey
        };
      });

      // Audit log
      await AuditLog.create({
        action: 'VIEW_RECORDS',
        actorId: req.user.id,
        targetType: 'PatientRecord',
        details: `Viewed and re-encrypted all records for patient ${req.user.id}`,
      });

      res.status(200).json({
        message: 'Records retrieved and re-encrypted successfully',
        records: reEncryptedRecords
      });
    } catch (error) {
      console.error('Error finalizing getMyRecord response:', error);
      return res.status(500).json({ message: 'Failed to finalize records response', error: error.message });
    }
  }
];


// Function to get a specific patient record by ID
exports.getRecordById = [
    fetchFrontendPublicKey, // Ensure keys are exchanged before processing
    async (req, res, next) => {
        const { role, id: requesterId } = req.user;
        try {
            const record = await PatientRecord.findById(req.params.id)
                .populate({ path: 'patient', select: 'assignedProviderId' });

            if (!record) {
                return res.status(404).json({ message: 'Record not found' });
            }

            const allowed = canViewRecordById(role, requesterId, record);
            if (!allowed) {
                return res.status(403).json({ message: 'Not authorized to view this record' });
            }

            req.record = record; // Pass record to middleware

            // Decrypt DB AES key using backend private key
            req.aesKey = loadAESKey(record.encryptedAesKey);

            console.log('Decrypted AES key from DB:', req.aesKey);

            next(); // Go to decryption middleware
        } catch (error) {
            console.error('Error pre-processing getRecordById:', error);
            return res.status(500).json({ message: 'Failed to retrieve record', error: error.message });
        }
    },

    decryptFieldsAESMiddleware(['diagnosis', 'notes', 'medications']),

    async (req, res) => {
        try {
            const decryptedRecord = req.record.toObject();

            // Generate new AES key for re-encryption
            const newAesKey = generateAESKey();

            // Encrypt new AES key with frontend test public key
            const newEncryptedAesKey = reEncryptWithFrontPubKey(newAesKey);

            console.log('Re-encrypted AES key for frontend:', newEncryptedAesKey);

            // Re-encrypt fields with new AES key
            encryptFieldsAESMiddleware(req, ['diagnosis', 'notes', 'medications'], newAesKey);

            // Replace decrypted fields with re-encrypted ones
            decryptedRecord.diagnosis = req.body.diagnosis;
            decryptedRecord.notes = req.body.notes;
            decryptedRecord.medications = req.body.medications;
            decryptedRecord.encryptedAesKey = newEncryptedAesKey;

            // Audit log
            await AuditLog.create({
                action: 'VIEW_RECORD',
                actorId: req.user.id,
                targetId: req.record._id,
                targetType: 'PatientRecord',
                details: `Viewed and re-encrypted record for patient ${req.record.patient._id}`,
            });

            res.status(200).json({
                message: 'Record retrieved and re-encrypted successfully',
                record: decryptedRecord,
                encryptedAesKey: newEncryptedAesKey
            });
        } catch (error) {
            console.error('Error in final getRecordById handler:', error);
            return res.status(500).json({ message: 'Failed to process record', error: error.message });
        }
    }
];
