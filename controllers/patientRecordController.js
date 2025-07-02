const PatientRecord = require('../models/PatientRecord');
const User = require('../models/User');
const { encryptWithPublicKey, decryptWithPrivateKey } = require('../utils/rsaUtils');
const { generateAESKey } = require('../helpers/cryptoHelper');
const AuditLog = require('../models/AuditLog');
const {
    canCreateRecord,
    canViewOwnRecord,
    canViewRecordById,
    canViewAllRecords,  
} = require('../utils/recordAccessRoles');
const { encryptAES, decryptAES } = require('../utils/aesUtils');

const { privateKey: backendPrivateKey } = require('../config/keyManager');


// Function to create a new patient record
exports.createRecord = async (req, res) => {
    const { role, id: creatorId } = req.user;
    const { patient, diagnosis, notes, medications, visitDate } = req.body;
    const frontendPublicKey = req.headers['x-client-public-key']; // RSA public key (PEM string)

    if (!frontendPublicKey) {
      return res.status(400).json({ message: 'Client public RSA key missing in header' });
    }

    
    try {
        if ( !canCreateRecord(role) ) {
            return res.status(403).json({ message: 'Only providers and managers can create patient records' });
        }

        if (!diagnosis || !notes || !medications || !visitDate) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        const today = new Date();
        const tzOffsetMs = today.getTimezoneOffset() * 60 * 1000;
        const localISO = new Date(today.getTime() - tzOffsetMs).toISOString().split('T')[0];


        //const today = new Date().toString().slice(0, 10);
        if (visitDate !== localISO) {
            return res.status(400).json({ message: 'Can only create records for today' });
        }

        const isAssigned = await User.exists({
            _id: creatorId,
            assignedPatients: patient
        });

        if (role === 'provider' && !isAssigned) {
            return res.status(403).json({ message: 'Provider can only create records for assigned patients' });
        }

        console.log('Frontend public key received:', frontendPublicKey);


        // Generate AES key
        const aesKey = generateAESKey();

        const medsString = Array.isArray(medications) ? medications.join(', ') : '';

        // Encrypt sensitive data
        const encryptedDiagnosis = encryptAES(diagnosis, aesKey);
        const encryptedNotes = encryptAES(notes, aesKey);
        const encryptedMedications = encryptAES(medsString, aesKey);

        console.log("Encrypting record fields:", {
            diagnosis: req.body.diagnosis,
            notes: req.body.notes,
            medications: req.body.medications
        });

        const normalizedPublicKey = frontendPublicKey.replace(/\\n/g, '\n');
        console.log("Normalized public key:", normalizedPublicKey);
        // Encrypt the AES key with the frontend public key
        const encryptedAesKey = encryptWithPublicKey(aesKey, normalizedPublicKey);

        const record = await PatientRecord.create({
            patient, diagnosis: encryptedDiagnosis, notes: encryptedNotes, medications: encryptedMedications, visitDate,
            createdBy: creatorId,
            encryptedAesKey,
        });

        console.log('Patient record inserted into MongoDB:', record);

        const recordPayload = {
            patient,
            diagnosis: encryptedDiagnosis,
            notes: encryptedNotes,
            medications: encryptedMedications,
            visitDate,
            createdBy: creatorId,
            encryptedAesKey,
        };

        console.log('Creating record with:', recordPayload);

        await AuditLog.create({
            action: 'create',
            model: 'PatientRecord',
            recordId: record._id,
            userId: creatorId,
            details: `Created record for patient ${patient}`,
        });
        return res.status(201).json({ message: 'Patient record created successfully', encryptedAesKey });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Record creation failed', error: error.message });
    }
};

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

    function normalizePEMKey(key) {
        if (key.includes('\\n')) {
            return key.replace(/\\n/g, '\n');
        }
        return key;
    }

    const normalizedPublicKey = normalizePEMKey(frontendPublicKey);

    const aesKey = decryptWithPrivateKey(record.encryptedAesKey, backendPrivateKey);

    const plain = record.toObject();

    const decryptedRecord = {
      ...plain,
      diagnosis: decryptAES(plain.diagnosis, aesKey),
      notes: decryptAES(plain.notes, aesKey),
      medications: plain.medications.map(m => decryptAES(m, aesKey)),
    };

    const newAesKey = generateAESKey();
    const newEncryptedAesKey = encryptWithPublicKey(newAesKey, normalizedPublicKey);

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