module.exports.canRegister = {
    Patient: [ 'Employee', 'Manager', 'Admin' ],
    Provider: [ 'Manager', 'Admin' ],
    Employee: [ 'Manager', 'Admin' ],
    Manager: [ 'Admin' ],
};