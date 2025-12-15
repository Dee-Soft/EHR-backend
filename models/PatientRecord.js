const mongoose = require('mongoose');

const patientRecordSchema = new mongoose.Schema({
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  diagnosis: { type: String, required: true }, // Encrypted via OpenBao Transit
  notes: { type: String, required: true }, // Encrypted via OpenBao Transit
  medications: { type: String, required: true }, // Encrypted via OpenBao Transit (JSON string)
  visitDate: { type: Date, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  encryptedAesKey: { type: String, required: true }, // RSA-wrapped AES key
  
  // OpenBao Transit Engine metadata
  transitKeyVersion: { 
    type: Number, 
    default: 1,
    required: false 
  },
  encryptionMetadata: {
    algorithm: { 
      type: String, 
      default: 'aes256-gcm96',
      required: false 
    },
    keyId: { 
      type: String, 
      default: 'ehr-aes-master',
      required: false 
    },
    encryptedAt: { 
      type: Date, 
      default: Date.now,
      required: false 
    }
  }
}, { timestamps: true });

// Index for efficient queries
patientRecordSchema.index({ patient: 1, visitDate: -1 });
patientRecordSchema.index({ createdBy: 1 });

module.exports = mongoose.model('PatientRecord', patientRecordSchema);
