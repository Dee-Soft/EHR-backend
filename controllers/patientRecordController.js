const PatientRecord = require('../models/PatientRecord');

exports.createRecord = async (req, res) => {
    try {
        const record = new PatientRecord({
            ...req.body,
            createdBy: req.user._id
        });
        await record.save();
        res.status(201).json({ message: 'Patient record created successfully', record });
    } catch (error) {
        console.error('Error creating patient record:', error);
        res.status(400).json({ message: 'Failed to create patient record', error: error.message });
    };

    exports.getAllRecords = async (req, res) => {
        try {
            const records = await PatientRecord.find().populate('patient', 'name email').populate('createdBy', 'name email');
            res.status(200).json(records);
        } catch (error) {
            console.error('Error fetching patient records:', error);
            res.status(500).json({ message: 'Failed to fetch patient records', error: error.message });
        }
    };

    exports.getRecordById = async (req, res) => {
        try {
            const record = await PatientRecord.findById(req.params.id).populate('patient', 'name email').populate('createdBy', 'name email');
            if (!record) {
                return res.status(404).json({ message: 'Patient record not found' });
            }
            // Check if the user has permission to view this record
            if (req.user.role !== 'Admin' && req.user.role !== 'Manager' && req.user.role !== 'Provider' && record.patient.toString() !== req.user._id.toString()) {
                return res.status(403).json({ message: 'Access denied' });
            }
            res.status(200).json(record);
        } catch (error) {
            console.error('Error fetching patient record:', error);
            res.status(500).json({ message: 'Failed to fetch patient record', error: error.message });
        }
    };

    exports.updateRecord = async (req, res) => {
        try {
            const record = await PatientRecord.findByIdAndUpdate(req.params.id, req.body, { new: true });
            if (!record) {
                return res.status(404).json({ message: 'Patient record not found' });
            }
            res.status(200).json({ message: 'Patient record updated successfully', record });
        } catch (error) {
            console.error('Error updating patient record:', error);
            res.status(400).json({ message: 'Failed to update patient record', error: error.message });
        }
    };

    exports.deleteRecord = async (req, res) => {
        try {
            const record = await PatientRecord.findByIdAndDelete(req.params.id);
            if (!record) {
                return res.status(404).json({ message: 'Patient record not found' });
            }
            res.status(200).json({ message: 'Patient record deleted successfully' });
        } catch (error) {
            console.error('Error deleting patient record:', error);
            res.status(400).json({ message: 'Failed to delete patient record', error: error.message });
        }
    };
};