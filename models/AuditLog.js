const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  action: { type: String }, 
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, 
  targetId: { type: String }, 
  targetType: { type: String }, 
  details: { type: String }, 
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
// This schema captures actions performed by users, including the actor's ID, target ID, type of target, and additional details about the action.