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
  gender: { type: String, enum: ['Male', 'Female', 'Other']},
  employeeId: { type: String}, // For employees
  providerId: { type: String}, // For providers
  managerId: { type: String}, // For managers
  adminId: { type: String}, // For admins
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

/**
 * Parse date string in dd-mm-yyyy format
 * @param {string} dateStr - Date string in format "dd-mm-yyyy"
 * @returns {Date} Parsed Date object
 */
const parseDateOfBirth = (dateStr) => {
  const [day, month, year] = dateStr.split('-').map(Number);
  // Note: month is 0-indexed in JavaScript Date
  return new Date(year, month - 1, day);
};

/**
 * Format date to dd-mm-yyyy format
 * @param {Date} date - Date object to format
 * @returns {string} Formatted date string
 */
const formatDateOfBirth = (date) => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

// Add date parsing/formatting as static methods
userSchema.statics.parseDateOfBirth = parseDateOfBirth;
userSchema.statics.formatDateOfBirth = formatDateOfBirth;

// Add date parsing/formatting as instance methods
userSchema.methods.formatDateOfBirth = function() {
  if (!this.dateOfBirth) return null;
  return formatDateOfBirth(this.dateOfBirth);
};

// Pre-save middleware to handle dateOfBirth parsing
userSchema.pre('save', function(next) {
  // If dateOfBirth is a string in dd-mm-yyyy format, parse it to Date
  if (this.dateOfBirth && typeof this.dateOfBirth === 'string') {
    try {
      this.dateOfBirth = parseDateOfBirth(this.dateOfBirth);
    } catch (error) {
      return next(new Error(`Invalid dateOfBirth format. Expected dd-mm-yyyy, got: ${this.dateOfBirth}`));
    }
  }
  next();
});

// Transform dateOfBirth to dd-mm-yyyy format when converting to JSON
userSchema.set('toJSON', {
  transform: function(doc, ret) {
    // Format dateOfBirth if it exists
    if (ret.dateOfBirth && ret.dateOfBirth instanceof Date) {
      ret.dateOfBirth = formatDateOfBirth(ret.dateOfBirth);
    }
    return ret;
  }
});

module.exports = mongoose.model('User', userSchema);