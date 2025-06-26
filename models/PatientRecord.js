const mongoose = require('mongoose');

const patientRecordSchema = new mongoose.Schema({
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  diagnosis: { type: String, required: true },
  medicantions: { type: [String], required: true },
  visitDate: { type: Date, default: Date.now },
  notes: { type: String, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

module.exports = mongoose.model('PatientRecord', patientRecordSchema);
