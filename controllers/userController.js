const User = require('./models/User');
const AuditLog = require('./models/AuditLog');
const { canRegister } = require('./utils/registrationRoles');

exports.registerUser = async (req, res) => {
  const creator = req.user;

  const { 
    name, email, password, role,
    phone, address, dateOfBirth, gender,
    employeeId, providerId
  } = req.body;
  try {
    if (!canRegister[role]?.includes(role)) {
      return res.status(403).json({ message: 'Not allowed to register this role' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: 'User already exists' });
    }

    const user = new User({
      name, email, password, role,
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

    //Only allow updates to phone/address for self unless admin 
    const isSelf = requester.id === user.id;
    const isAdmin = requester.role === 'Admin';

    if (!isSelf && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized to update this user' });
    };


    if(isSelf && ['Patient', 'Employee'].includes(user.role)) {
      // Allow self to update phone/address only
      const { phone, address } = req.body;
      user.phone = phone || user.phone;
      user.address = address || user.address;
    }

    // Admin can edit anyone's details
    if (isAdmin) {
      Object.assign(user, req.body);
    }

    await user.save();

    await AuditLog.create({
      action: 'UPDATE_USER',
      actorId: requester.id,
      targetId: user._id,
      targetType: 'User',
      details: `Updated user ${user.name}`
    });

    res.json({
      message: 'User updated successfully'
    });
  } catch (err) {
    res.status(500).json({ message: 'User update failed'
    });
  }
};
