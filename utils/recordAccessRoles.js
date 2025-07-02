module.exports = {
    canCreateRecord: (role) => ['Provider', 'Manager'].includes(role),

    canViewAllRecords: (role) => ['Provider', 'Manager'].includes(role),

    canViewOwnRecord: (role, requesterId, recordPatientId) => {
        return role === 'Patient' && requesterId === recordPatientId.toString();
    },

    canViewRecordById: (role, requesterId, record) => {
        if (role === 'Patient' && requesterId === record.patient._id.toString()) {
            return true;
        }

        if (role === 'Manager') {
            return true;
        }
        
        if (role === 'Provider') {
            return record.patient.assignedProviderId?.toString() === requesterId;
        }
        return false;
    }
};