const roles = {
  Patient: { can: ['read_own_profile'] },
  Provider: { can: ['read_own_profile', 'update_patient_notes'] },
  Employee: { can: ['read_any_profile', 'update_any_profile'] },
  Manager: { can: ['read_any_profile', 'update_any_profile', 'manage_employees'] },
  Admin: { can: ['read_any_profile', 'update_any_profile', 'manage_users', 'manage_system'] }
};
module.exports = roles;
