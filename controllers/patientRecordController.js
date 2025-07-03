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

const { encryptWithBackendPubKey } = require('../utils/rsaUtils');
const encryptFieldsAESMiddleware = require('../middlewares/encryptFieldsAESMiddleware');



// Function to create a new patient record
exports.createRecord = [
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
exports.getAllRecords = async (req, res) => {
    const { role, id } = req.user;

  try {
    if (!canViewAllRecords(role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const frontendPublicKey = req.headers['x-client-public-key'];
    if (!frontendPublicKey) {
      return res.status(400).json({ message: 'Missing x-client-public-key header' });
    }
    const normalizedPublicKey = frontendPublicKey.replace(/\\n/g, '\n');

    const query = role === 'Provider'
      ? { patient: { $in: (await User.findById(id).select('assignedPatients')).assignedPatients } }
      : {};

    const records = await PatientRecord.find(query).populate('patient');

    const reEncryptedRecords = records.map(record => {
      const aesKey = decryptWithPrivateKey(record.encryptedAesKey, backendPrivateKey);

      const plain = record.toObject();

      const decrypted = {
        ...plain,
        diagnosis: decryptAES(plain.diagnosis, aesKey),
        notes: decryptAES(plain.notes, aesKey),
        medications: plain.medications.map(m => decryptAES(m, aesKey)),
      };

      const newAesKey = generateAESKey();
      const encryptedAesKey = encryptWithPublicKey(newAesKey, normalizedPublicKey);

      return {
        ...decrypted,
        diagnosis: encryptAES(decrypted.diagnosis, newAesKey),
        notes: encryptAES(decrypted.notes, newAesKey),
        medications: decrypted.medications.map(m => encryptAES(m, newAesKey)),
        encryptedAesKey,
      };
    });

    res.status(200).json({ records: reEncryptedRecords });
  } catch (error) {
    console.error('Error retrieving records:', error);
    res.status(500).json({ message: 'Failed to retrieve records', error: error.message });
  }
};

// Function to get patient's own record
exports.getMyRecord = async (req, res) => {
    const { role, id } = req.user;

  try {
    if (!canViewOwnRecord(role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const frontendPublicKey = req.headers['x-client-public-key'];
    if (!frontendPublicKey) {
      return res.status(400).json({ message: 'Missing x-client-public-key header' });
    }
    const normalizedPublicKey = frontendPublicKey.replace(/\\n/g, '\n');

    const records = await PatientRecord.find({ patient: id }).populate('patient');

    const reEncryptedRecords = records.map(record => {
      const aesKey = decryptWithPrivateKey(record.encryptedAesKey, backendPrivateKey);
      const plain = record.toObject();

      const decrypted = {
        ...plain,
        diagnosis: decryptAES(plain.diagnosis, aesKey),
        notes: decryptAES(plain.notes, aesKey),
        medications: plain.medications.map(m => decryptAES(m, aesKey)),
      };

      const newAesKey = generateAESKey();
      const encryptedAesKey = encryptWithPublicKey(newAesKey, normalizedPublicKey);

      return {
        ...decrypted,
        diagnosis: encryptAES(decrypted.diagnosis, newAesKey),
        notes: encryptAES(decrypted.notes, newAesKey),
        medications: decrypted.medications.map(m => encryptAES(m, newAesKey)),
        encryptedAesKey,
      };
    });

    res.status(200).json({ records: reEncryptedRecords });
  } catch (error) {
    console.error('Error retrieving own records:', error);
    res.status(500).json({ message: 'Failed to retrieve your records', error: error.message });
  }
};

// Function to get a specific patient record by ID
exports.getRecordById = async (req, res) => {
    try {
    const { role, id: requesterId } = req.user;

    const record = await PatientRecord.findById(req.params.id)
      .populate({ path: 'patient', select: 'assignedProviderId' });

    if (!record) {
      return res.status(404).json({ message: 'Record not found' });
    }

    const allowed = canViewRecordById(role, requesterId, record);
    if (!allowed) {
      return res.status(403).json({ message: 'Not authorized to view this record' });
    }

    const frontendPublicKey = req.headers['x-client-public-key'];
    if (!frontendPublicKey) {
      return res.status(400).json({ message: 'Missing x-client-public-key header' });
    }

    const aesKey = decryptWithPrivateKey(record.encryptedAesKey, backendPrivateKey);

    const plain = record.toObject();

    const decryptedRecord = {
      ...plain,
      diagnosis: decryptAES(plain.diagnosis, aesKey),
      notes: decryptAES(plain.notes, aesKey),
      medications: plain.medications.map(m => decryptAES(m, aesKey)),
    };

    const newAesKey = generateAESKey();
    const newEncryptedAesKey = encryptWithPublicKey(newAesKey, frontendPublicKey);

    const reEncryptedRecord = {
      ...decryptedRecord,
      diagnosis: encryptAES(decryptedRecord.diagnosis, newAesKey),
      notes: encryptAES(decryptedRecord.notes, newAesKey),
      medications: decryptedRecord.medications.map(m => encryptAES(m, newAesKey)),
    };

    await AuditLog.create({
      action: 'VIEW_RECORD',
      actorId: requesterId,
      targetId: record._id,
      targetType: 'PatientRecord',
      details: `Viewed record for patient ${record.patient._id}`,
    });

    res.status(200).json({ record: reEncryptedRecord, encryptedAesKey: newEncryptedAesKey });
  } catch (error) {
    console.error('Error retrieving record by ID:', error);
    res.status(500).json({ message: 'Failed to retrieve record', error: error.message });
  }
};