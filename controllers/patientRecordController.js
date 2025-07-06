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
    //sendBackendPublicKey, // Ensure keys are exchanged before processing

    loadAESKey, // decrypt AES key from header
    decryptFieldsAESMiddleware(['diagnosis', 'notes', 'medications']),
    
    async (req, res, next) => {
        const { role, id: creatorId } = req.user;
        const { patient, diagnosis, notes, medications, visitDate } = req.body;
        const frontendPublicKey = req.headers['x-client-public-key']

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

            // Generate new AES key for DB storage
            const dbAESKey = generateAESKey();

            // Attach DB AES key to request for encryption middleware
            req.aesKey = dbAESKey;

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
        const frontendPublicKey = req.headers['x-client-public-key'];

        try {
            // Encrypt DB AES key with frontend public key
            const encryptedDbAESKey = reEncryptWithFrontPubKey(req.aesKey, frontendPublicKey);

            // Save encrypted fields and encrypted AES key in DB
            const record = await PatientRecord.create({
                patient,
                diagnosis,
                notes,
                medications,
                visitDate,
                createdBy: creatorId,
                encryptedAesKey: encryptedDbAESKey
            });

            await AuditLog.create({
                action: 'CREATE_RECORD',
                actorId: creatorId,
                targetId: record._id,
                targetType: 'PatientRecord',
                details: `Created record for patient ${patient}`,
            });

            return res.status(201).json({
                message: 'Record created successfully',
                recordId: record._id
            });
        } catch (error) {
            console.error('Error saving record:', error);
            return res.status(500).json({ message: 'Record creation failed', error: error.message });
        }
    }
];

// Function to get all patient records
exports.getAllRecords = async (req, res) => {
    const { role, id: requesterId } = req.user;
    try {
        if (!canViewAllRecords(role)) {
            return res.status(403).json({ message: 'Only managers can view all records' });
        }

            const records = await PatientRecord.find().populate({ path: 'patient' });
            if (!records || records.length === 0) {
                return res.status(404).json({ message: 'No records found' });
            }

            const responseRecords = records.map(record => {
                return {
                    id: record._id,
                    patient: record.patient,
                    diagnosis: record.diagnosis,
                    notes: record.notes,
                    medications: record.medications,
                    visitDate: record.visitDate,
                    createdBy: record.createdBy,
                    createdAt: record.createdAt,
                    updatedAt: record.updatedAt,
                    encryptedAesKey: record.encryptedAesKey
                };
            });

            await AuditLog.create({
                action: 'VIEW_ALL_RECORDS',
                actorId: req.user.id,
                targetType: 'PatientRecord',
                details: `Manager viewed all patient records`,
            });

            res.status(200).json({
                message: 'All records retrieved successfully',
                records: responseRecords
            });
        } catch (error) {
            console.error('Error retrieving getAllRecords:', error);
            return res.status(500).json({ message: 'Failed to retrieve  all records', error: error.message });
        }
    };


// Function to get patient's own record
exports.getMyRecord = async (req, res) => {
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

      const responseRecords = records.map(record => ({
            _id: record._id,
            patient: record.patient,
            diagnosis: record.diagnosis,
            notes: record.notes,
            medications: record.medications,
            visitDate: record.visitDate,
            encryptedAesKey: record.encryptedAesKey
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
      return res.status(500).json({ message: 'Failed to retrieve patient records', error: error.message });
    }
};


// Function to get a specific patient record by ID
exports.getRecordById = async (req, res) => {
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

            // Get the response record
            const responseRecord = {
                _id: record._id,
                patient: record.patient,
                diagnosis: record.diagnosis,
                notes: record.notes,
                medications: record.medications,
                visitDate: record.visitDate,
                encryptedAesKey: record.encryptedAesKey
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
            return res.status(500).json({ message: 'Failed to retrieve record', error: error.message });
        }
    };