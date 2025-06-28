module.exports = {
    canCreateRecord: (role) => ['Provider', 'Manager'].includes(role),

    canViewAllRecord: (role) => ['Provider', 'Manager'].includes(role),

    canViewOwnRecord: (role, requesterId, recordPatientId) => {
        return role === 'Patient' && requesterId === recordPatientId.toString() ||;
    },

    canViewRecordById: (role, requesterId, record) => {
        if (role === 'Patient' && requesterId === record.patient.toString()) {
            return true;
        }
        if (['Provider', 'Manager'].includes(role)) {
            return true;
        }
    }
};