module.exports = {
    canCreateRecord: (role) => ['Provider', 'Manager', 'Admin'].includes(role),

    canViewAllRecords: (role) => ['Manager', 'Admin'].includes(role),

    canViewOwnRecord: (role, requesterId, record) => {
        if (role === 'Patient' && requesterId === record.patient._id.toString()) {
            return true;
        }
        return false;
    },

    canViewRecordById: (role, requesterId, record) => {
        // Admin can view any record
        if (role === 'Admin') {
            return true;
        }
        
        // Patient can view their own record
        if (role === 'Patient' && requesterId === record.patient._id.toString()) {
            return true;
        }

        // Manager can view any record
        if (role === 'Manager') {
            return true;
        }
        
        // Provider can view assigned patient records
        if (role === 'Provider') {
            return record.patient.assignedProviderId?.toString() === requesterId;
        }
        
        return false;
    }
};