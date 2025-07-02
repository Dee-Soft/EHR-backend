const mongoose = require('mongoose');

const patientRecordSchema = new mongoose.Schema({
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  diagnosis: { type: String, required: true },
  notes: { type: String, required: true },
  medications: { type: [String], required: true },
  visitDate: { type: Date, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  encryptedAesKey: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('PatientRecord', patientRecordSchema);
