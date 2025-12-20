module.exports = {
    // ONLY Providers can create records
    canCreateRecord: (role) => ['Provider'].includes(role),

    // NO ONE can view all records
    canViewAllRecords: (role) => false,

    // Patients can view their own records
    canViewOwnRecord: (role, requesterId, record) => {
        if (role === 'Patient' && requesterId === record.patient._id.toString()) {
            return true;
        }
        return false;
    },

    // ONLY Patients (own) and Providers (assigned) can view records
    canViewRecordById: (role, requesterId, record) => {
        // Patient can view their own record
        if (role === 'Patient' && requesterId === record.patient._id.toString()) {
            return true;
        }
        
        // Provider can view assigned patient records
        if (role === 'Provider') {
            return record.patient.assignedProviderId?.toString() === requesterId;
        }
        
        // NO ONE ELSE can view records
        return false;
    }
};