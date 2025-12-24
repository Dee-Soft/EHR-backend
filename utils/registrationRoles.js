/**
 * Registration Roles Utility
 * Defines which roles can register which other roles in the system.
 * 
 * This utility enforces Role-Based Access Control (RBAC) for user registration.
 * The structure follows: canRegister[targetRole] = [array of roles that can register this targetRole]
 * 
 * Registration Hierarchy:
 * 1. Admin: Can register all roles (Patient, Provider, Employee, Manager, Admin)
 * 2. Manager: Can register Patient, Provider, Employee
 * 3. Employee: Can register Patient only
 * 4. Provider: Cannot register any users (not in the mapping)
 * 5. Patient: Cannot register any users (not in the mapping)
 * 
 * Usage Example:
 * ```javascript
 * const { canRegister } = require('./utils/registrationRoles');
 * 
 * // Check if a Manager can register an Employee
 * if (canRegister['Employee']?.includes('Manager')) {
 *   // Registration allowed
 * }
 * 
 * // Check if an Employee can register a Provider
 * if (canRegister['Provider']?.includes('Employee')) {
 *   // This will be false - Employees cannot register Providers
 * }
 * ```
 * 
 * Note: This utility is used by registration controllers to validate
 * if a user has permission to register another user with a specific role.
 */

module.exports.canRegister = {
    // Patient can be registered by Employee, Manager, or Admin
    Patient: [ 'Employee', 'Manager', 'Admin' ],
    
    // Provider can be registered by Manager or Admin only
    Provider: [ 'Manager', 'Admin' ],
    
    // Employee can be registered by Manager or Admin only
    Employee: [ 'Manager', 'Admin' ],
    
    // Manager can be registered by Admin only
    Manager: [ 'Admin' ],
    
    // Note: Admin can register other Admins, but this is typically handled
    // in the admin registration controller with additional checks
};