const mongoose = require('mongoose');

const patientRecordSchema = new mongoose.Schema({
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  diagnosis: { type: String},
  notes: { type: String },
  medications: { type: [String]},
  visitDate: { type: Date, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User'},
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('PatientRecord', patientRecordSchema);
