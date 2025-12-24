/**
 * Update Roles Utility
 * Defines which roles can update which other roles
 * 
 * Structure: canUpdate[targetRole] = [array of roles that can update this targetRole]
 * 
 * Rules based on userController.js updateUser logic:
 * 1. Patient: 
 *    - Self: can update phone/address only
 *    - Admin, Manager, Employee: can update any field
 * 2. Employee: Admin or Manager only
 * 3. Provider: Admin or Manager only
 * 4. Manager: Admin only
 * 5. Admin: Admin only (self-update or by other admins)
 */

module.exports.canUpdate = {
    // Patient can be updated by Admin, Manager, Employee, or self (limited fields)
    Patient: ['Admin', 'Manager', 'Employee', 'Patient'],
    
    // Employee can only be updated by Admin or Manager
    Employee: ['Admin', 'Manager'],
    
    // Provider can only be updated by Admin or Manager
    Provider: ['Admin', 'Manager'],
    
    // Manager can only be updated by Admin
    Manager: ['Admin'],
    
    // Admin can only be updated by Admin (including self)
    Admin: ['Admin']
};

/**
 * Check if a requester can update a target user
 * @param {string} requesterRole - Role of the user trying to update
 * @param {string} targetRole - Role of the user being updated
 * @param {boolean} isSelf - Whether the requester is updating themselves
 * @returns {boolean} True if update is allowed
 */
module.exports.canUserUpdate = (requesterRole, targetRole, isSelf = false) => {
    // Special case: Patient updating themselves (limited fields)
    if (isSelf && targetRole === 'Patient' && requesterRole === 'Patient') {
        return true;
    }
    
    // Special case: Admin updating themselves
    if (isSelf && targetRole === 'Admin' && requesterRole === 'Admin') {
        return true;
    }
    
    // For all other cases, check the canUpdate mapping
    return module.exports.canUpdate[targetRole]?.includes(requesterRole) || false;
};

/**
 * Get allowed update fields based on requester role and target role
 * @param {string} requesterRole - Role of the user trying to update
 * @param {string} targetRole - Role of the user being updated
 * @param {boolean} isSelf - Whether the requester is updating themselves
 * @returns {Array} Array of field names that can be updated
 */
module.exports.getAllowedUpdateFields = (requesterRole, targetRole, isSelf = false) => {
    // Base fields that can be updated by anyone with permission
    const baseFields = ['name', 'email', 'phone', 'address'];
    
    // Role-specific fields
    const roleSpecificFields = {
        Patient: ['dateOfBirth', 'gender', 'assignedProviderId'],
        Employee: ['employeeId'],
        Provider: ['providerId', 'assignedPatients'],
        Manager: ['managerId'],
        Admin: ['adminId']
    };
    
    // Special case: Patient updating themselves (only phone and address)
    if (isSelf && targetRole === 'Patient' && requesterRole === 'Patient') {
        return ['phone', 'address'];
    }
    
    // If requester has permission to update this role
    if (module.exports.canUserUpdate(requesterRole, targetRole, isSelf)) {
        const fields = [...baseFields];
        
        // Add role-specific fields if target has that role
        if (roleSpecificFields[targetRole]) {
            fields.push(...roleSpecificFields[targetRole]);
        }
        
        return fields;
    }
    
    return [];
};
