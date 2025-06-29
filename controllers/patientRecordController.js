const PatientRecord = require('./models/PatientRecord');
const User = require('./models/User');
const AuditLog = require('./models/AuditLog');
const {
    canCreateRecord,
    canViewOwnRecord,
    canViewRecordById,
    canViewAllRecords,  
} = require('./utils/recordAccessRoles');
const { encryptAES, decryptAES } = require('./utils/aesUtils');

// Function to create a new patient record
exports.createPatientRecord = async (req, res) => {
    const { role, id: creatorId, aesKey } = req.user;
    const { patient, diagnosis, notes, medications, visitDate } = req.body;

    try {
        if ( !canCreateRecord(role) ) {
            return res.status(403).json({ message: 'Only providers and managers can create patient records' });
        }

        const today = new Date().toString().slice(0, 10);
        if (visitDate.slice(0, 10) !== today) {
            return res.status(400).json({ message: 'Can only create records for today' });
        }

        const isAssigned = await User.exists({
            _id: creatorId,
            assignedPatients: patient
        });

        if (role === 'provider' && !isAssigned) {
            return res.status(403).json({ message: 'Provider can only create records for assigned patients' });
        }

        // Encrypt sensitive data
        const encryptedDiagnosis = encryptAES(diagnosis, aesKey);
        const encryptedNotes = encryptAES(notes, aesKey);
        const encryptedMedications = encryptAES(medications, aesKey);

        const record = await PatientRecord.create({
            patient, diagnosis: encryptedDiagnosis, notes: encryptedNotes, medications: encryptedMedications, visitDate,
            createdBy: creatorId,
        });

        await AuditLog.create({
            action: 'create',
            model: 'PatientRecord',
            recordId: record._id,
            userId: creatorId,
            details: `Created record for patient ${patient}`,
        });
        return res.status(201).json({ message: 'Patient record created successfully' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Record creation failed', error: error.message });
    }
};

// Function to get all patient records
exports.getAllRecords = async (req, res) => {
    const { role, id, aesKey } = req.user;
    try {
        if (!canViewAllRecords(role)) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const query = role === 'Provider'? { patient: { $in: (await User.findById(id).select('assignedPatients'))}} : {};

        const records = await PatientRecord.find(query)
            .populate('patient');

        const decryptedRecords = records.map(record => ({
            ...record.toObject(),
            diagnosis: decryptAES(record.diagnosis, aesKey),
            notes: decryptAES(record.notes, aesKey),
            medications: JSON.parse(decryptAES(record.medications, aesKey)),
        }));
        res.status(200).json(decryptedRecords);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to retrieve records' });
    }
};

// Function to get patient's own record
exports.getMyRecord = async (req, res) => {
    try {
        const { id, role, aesKey } = req.user;

        const record = await PatientRecord.find({ patient: id });
        if (!record.length) {
            return res.status(404).json({ message: 'Record not found' });
        }

        if (!canViewOwnRecord(role, id, id)) {
            return res.status(403).json({ message: 'Not authorized to view this record' });
        }

        const decryptedRecord = record.map(record => ({
            ...record.toObject(),
            diagnosis: decryptAES(record.diagnosis, aesKey),
            notes: decryptAES(record.notes, aesKey),
            medications: JSON.parse(decryptAES(record.medications, aesKey)),
        }));
        res.status(200).json(decryptedRecord);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to retrieve record' });
    }
};

// Function to get a specific patient record by ID
exports.getRecordById = async (req, res) => {
    try {
        const { role, id: requesterId, aesKey } = req.user;
        const record = await PatientRecord.findById(req.params.id)
            .populate('patient');

    if (!record) {
        return res.status(404).json({ message: 'Record not found' });
    }

    const allowed = canViewRecordById(role, requesterId, record);
    if (!allowed) {
        return res.status(403).json({ message: 'Not authorized to view this record' });
    }

    // Decrypt sensitive data
    const decryptedRecord = {
        ...record.toObject(),
        diagnosis: decryptAES(record.diagnosis, aesKey),
        notes: decryptAES(record.notes, aesKey),
        medications: JSON.parse(decryptAES(record.medications, aesKey)),
    };

    // Log the access to the record
    await AuditLog.create({
        action: 'VIEW_RECORD',
        actorId: requesterId,
        targetId: record._id,
        targetType: 'PatientRecord',
        details: `Viewed record for patient ${record.patient._id}`,
    });

    res.status(200).json(record);
} catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to retrieve record' });
}
};