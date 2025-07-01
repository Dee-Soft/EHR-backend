const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { canRegister } = require('../utils/registrationRoles');

const crypto = require('crypto');

exports.registerUser = async (req, res) => {
  const creator = req.user;

  const { 
    name, email, password, role,
    phone, address, dateOfBirth, gender,
    employeeId, providerId
  } = req.body;
  try {
    if (!canRegister[role]?.includes(creator.role)) {
      return res.status(403).json({ message: `Not allowed to register this ${role}` });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: 'User already exists' });
    }

    const generatedAESKey = crypto.randomBytes(32).toString('hex');

    const user = new User({
      name, email, password, role, aesKey: generatedAESKey,
      phone, address, gender,
      dateOfBirth: role === 'Patient' ? dateOfBirth : undefined,
      employeeId: role === 'Employee' ? employeeId : undefined,
      providerId: role === 'Provider' ? providerId : undefined
    });

    await user.save();

    await AuditLog.create({
      action: 'REGISTER_USER',
      actorId: creator.id,
      targetId: user._id,
      targetType: 'User',
      details: `Created ${role}: ${user.name}`
    });

    res.status(201).json({
      message: 'User registered successfully'
    });
  } catch (err) {
    res.status(500).json({ message: 'User registration failed' });
  }
};

exports.updateUser = async (req, res) => {
  const requester = req.user;
  const { id } = req.params;

  try {
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    };

    const isSelf = requester.id === user.id;
    const isAdmin = requester.role === 'Admin';
    const isManager = requester.role === 'Manager';
    const isEmployee = requester.role === 'Employee';

    //Patient can only update their own phone/address
    if (user.role === 'Patient') {
      if(isSelf) {
        // Allow self to update phone/address only
        const { phone, address } = req.body;
        user.phone = phone || user.phone;
        user.address = address || user.address;
      }
      else if (isAdmin ||isManager || isEmployee) {
        // Allow admin/manager/employee to update any field
        Object.assign(user, req.body);
      }
      else {
        return res.status(403).json({ message: 'Not authorized to update this patient' });
      }
    }
    

    // Employee details can only be updated by Admin or Manager
    else if (user.role === 'Employee') {
      if (!(isAdmin || isManager)) {
        return res.status(403).json({ message: 'Only admin or manager authorized to update this employee' });
      }
      Object.assign(user, req.body);
    }

    // Provider details can only be updated by Admin or Manager
    else if (user.role === 'Provider') {
      if (!(isAdmin || isManager)) {
        return res.status(403).json({ message: 'Only admin or manager authorized to update this provider' });
      }
      Object.assign(user, req.body);
    }

    // Manager details can only be updated by Admin
    else if (user.role === 'Manager') {
      if (!(isAdmin)) {
        return res.status(403).json({ message: 'Only admin authorized to update this manager' });
      }
      Object.assign(user, req.body);
    }
  

    await user.save();

    await AuditLog.create({
      action: 'UPDATE_USER',
      actorId: requester.id,
      targetId: user._id,
      targetType: 'User',
      details: `Updated user ${user.name} with role ${user.role}`
    });

    res.json({
      message: `User ${user.name} with role ${user.role} updated successfully`
    });
  } catch (err) {
    res.status(500).json({ message: 'User update failed', error: err.message
    });
  }
};
