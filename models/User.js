const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  name: { type: String},
  email: { type: String, unique: true },
  password: { type: String },
  role: { type: String, enum: ['Patient', 'Provider', 'Employee', 'Manager', 'Admin'], required: true, default: 'Patient' },
  phone: { type: String},
  address: { type: String},
  dateOfBirth: { type: Date},
  gender: { type: { type: String}, enum: ['Male', 'Female', 'Other']},
  employeeId: { type: String}, // For employees
  providerId: { type: String}, // For providers
  assignedProviderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // For patients
  assignedPatients: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // For providers
}, {
  timestamps: true
});

// Hash password before saving user
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Method to compare password for authentication
userSchema.methods.comparePassword = async function (plainPassword) {
  return await bcrypt.compare(plainPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);