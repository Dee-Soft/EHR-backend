const PatientRecord = require('./models/PatientRecord');
const User = require('./models/User');
const AuditLog = require('./models/AuditLog');
const {
    canCreateRecord,
    canViewOwnRecord,
    canViewRecordById,
    canViewAllRecords,  
} = require('./utils/recordAccessRoles');

// Function to create a new patient record
exports.createPatientRecord = async (req, res) => {
    const { role, id: creatorId } = req.user;
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

        const record = await PatientRecord.create({
            patient, diagnosis, notes, medications, visitDate,
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
        return res.status(500).json({ message: 'Record creation failed' });
    }
};

// Function to get all patient records
exports.getAllRecords = async (req, res) => {
    const { role, id} = req.user;
    try {
        if (!canViewAllRecords(role)) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const query = role === 'Provider'? { patient: { $in: (await User.findById(id).select('assignedPatients'))}} : {};

        const records = await PatientRecord.find(query)
            .populate('patient');
        res.status(200).json(records);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to retrieve records' });
    }
};

// Function to get patient's own record
exports.getMyRecord = async (req, res) => {
    try{
        const { id, role } = req.user;

        const record = await PatientRecord.find({ patient: id });
        if (!record.length) {
            return res.status(404).json({ message: 'Record not found' });
        }

        if (!canViewOwnRecord(role, id, id)) {
            return res.status(403).json({ message: 'Not authorized to view this record' });
        }
        res.status(200).json(record);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to retrieve record' });
    }
};

// Function to get a specific patient record by ID
exports.getRecordById = async (req, res) => {
    try {
    const { role, id } = req.user;
    const record = await PatientRecord.findById(req.params.id)
        .populate('patient');

    if (!record) {
        return res.status(404).json({ message: 'Record not found' });
    }

    const allowed = canViewRecordById(role, id, record);
    if (!allowed) {
        return res.status(403).json({ message: 'Not authorized to view this record' });
    }

    // Log the access to the record
    await AuditLog.create({
        action: 'VIEW_RECORD',
        actorId: id,
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