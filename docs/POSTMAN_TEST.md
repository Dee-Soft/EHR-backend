# Postman Testing Guide for EHR Backend

## Overview

This document provides comprehensive instructions for testing the EHR (Electronic Health Record) backend system using Postman. The guide covers RBAC (Role-Based Access Control) testing, patient record operations, and the encryption/decryption workflow.

## Prerequisites

1. **Postman Installed**: Download and install Postman from [postman.com](https://www.postman.com/downloads/)
2. **Backend Running**: Ensure the EHR backend is running on `http://localhost:3001`
3. **Test Users Created**: Run the test user creation script:
   ```bash
   npm run create-test-users
   ```
   Or use the existing test users from the fixtures.

## Test Environment Setup

### Base URL
```
http://localhost:3001/api
```

### Test User Credentials

| Role | Email | Password | Purpose |
|------|-------|----------|---------|
| Admin | `admin@test.com` | `Password123!` | Full system access tests |
| Manager | `manager@test.com` | `Password123!` | Management function tests |
| Employee | `employee@test.com` | `Password123!` | Employee function tests |
| Provider | `provider@test.com` | `Password123!` | Medical record creation tests |
| Patient | `patient@test.com` | `Password123!` | Patient access tests |
| Assigned Patient | `patient2@test.com` | `Password123!` | Provider assignment tests |

### Postman Environment Variables

Create a new Postman environment with these variables:

```json
{
  "base_url": "http://localhost:3001/api",
  "admin_email": "admin@test.com",
  "admin_password": "Password123!",
  "manager_email": "manager@test.com",
  "manager_password": "Password123!",
  "employee_email": "employee@test.com",
  "employee_password": "Password123!",
  "provider_email": "provider@test.com",
  "provider_password": "Password123!",
  "patient_email": "patient@test.com",
  "patient_password": "Password123!",
  "patient2_email": "patient2@test.com",
  "patient2_password": "Password123!"
}
```

## Authentication Testing

### 1. Login and Token Management

**Endpoint**: `POST {{base_url}}/auth/login`

**Request Body**:
```json
{
  "email": "{{admin_email}}",
  "password": "{{admin_password}}"
}
```

**Expected Response** (200 OK):
```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "id": "user_id_here",
    "name": "Admin User",
    "email": "admin@test.com",
    "role": "Admin"
  }
}
```

**Important**: The JWT token is automatically set as an HTTP-only cookie. Postman will handle this automatically.

### 2. Get Current User

**Endpoint**: `GET {{base_url}}/auth/me`

**Headers**: Cookie is automatically sent by Postman

**Expected Response** (200 OK):
```json
{
  "success": true,
  "message": "User retrieved successfully",
  "user": {
    "id": "user_id_here",
    "name": "Admin User",
    "email": "admin@test.com",
    "role": "Admin",
    "phone": "1234567890",
    "address": "123 Admin St"
  }
}
```

### 3. Logout

**Endpoint**: `POST {{base_url}}/auth/logout`

**Expected Response** (200 OK):
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

## RBAC Testing Scenarios

### Registration Permissions Matrix

| Target Role | Can Be Registered By | Cannot Be Registered By |
|-------------|---------------------|-------------------------|
| Patient | Employee, Manager, Admin | Provider, Patient |
| Provider | Manager, Admin | Employee, Provider, Patient |
| Employee | Manager, Admin | Employee, Provider, Patient |
| Manager | Admin | Employee, Provider, Patient, Manager |
| Admin | Admin | All other roles |

### Test Case 1: Employee Registering Patient (Allowed)

**Prerequisite**: Login as Employee
**Endpoint**: `POST {{base_url}}/users/register`

**Request Body**:
```json
{
  "name": "New Patient",
  "email": "new.patient@test.com",
  "password": "Password123!",
  "role": "Patient",
  "phone": "555-0105",
  "address": "101 Test Road",
  "dateOfBirth": "1995-05-20",
  "gender": "Male"
}
```

**Expected Response**: 201 Created

### Test Case 2: Employee Registering Provider (Forbidden)

**Prerequisite**: Login as Employee
**Endpoint**: `POST {{base_url}}/users/register`

**Request Body**:
```json
{
  "name": "New Provider",
  "email": "new.provider@test.com",
  "password": "Password123!",
  "role": "Provider",
  "phone": "555-0106",
  "address": "202 Test Avenue"
}
```

**Expected Response**: 403 Forbidden
```json
{
  "success": false,
  "message": "Not allowed to register this Provider"
}
```

### Test Case 3: Manager Registering Employee (Allowed)

**Prerequisite**: Login as Manager
**Endpoint**: `POST {{base_url}}/users/register`

**Request Body**:
```json
{
  "name": "New Employee",
  "email": "new.employee@test.com",
  "password": "Password123!",
  "role": "Employee",
  "phone": "555-0107",
  "address": "303 Test Lane",
  "employeeId": "EMP-002"
}
```

**Expected Response**: 201 Created

### Test Case 4: Provider Registering Patient (Forbidden)

**Prerequisite**: Login as Provider
**Endpoint**: `POST {{base_url}}/users/register`

**Request Body**:
```json
{
  "name": "Another Patient",
  "email": "another.patient@test.com",
  "password": "Password123!",
  "role": "Patient",
  "phone": "555-0108",
  "address": "404 Test Circle"
}
```

**Expected Response**: 403 Forbidden

## Patient Record Testing

### Important Notes About Encryption

The EHR system uses a dual-key encryption architecture:
1. **Frontend Encryption**: Sensitive data is encrypted with a frontend AES key before sending
2. **Backend Re-encryption**: Data is re-encrypted with backend's AES key for storage
3. **Key Exchange**: Backend's AES key is wrapped with frontend's RSA public key

For Postman testing, we'll use simplified test data without actual encryption.

### Test Case 1: Provider Creating Patient Record (Allowed)

**Prerequisite**: 
1. Login as Provider
2. Ensure patient is assigned to provider (patient2@test.com is pre-assigned)

**Endpoint**: `POST {{base_url}}/patient-records`

**Request Body**:
```json
{
  "patient": "patient_user_id_here", // Use patient2's ID
  "diagnosis": "Common cold with mild fever",
  "notes": "Patient presented with runny nose, cough, and temperature of 38.2°C. No serious complications observed.",
  "medications": ["Paracetamol 500mg every 6 hours", "Vitamin C supplements"],
  "visitDate": "30-12-2025 10:30" // Must be today's date
}
```

**Headers** (for encryption flow):
```
x-client-public-key: <frontend_rsa_public_key_base64>
x-aes-key: <encrypted_frontend_aes_key>
```

**Expected Response**: 201 Created
```json
{
  "message": "Record created successfully",
  "recordId": "record_id_here",
  "record": {
    "patient": "patient_id_here",
    "diagnosis": "encrypted_data_here",
    "notes": "encrypted_data_here",
    "medications": ["encrypted_data_here"],
    "visitDate": "30-12-2025 10:30",
    "encryptedAesKey": "wrapped_key_here",
    "transitKeyVersion": "key_version_here"
  }
}
```

### Test Case 2: Patient Creating Record (Forbidden)

**Prerequisite**: Login as Patient
**Endpoint**: `POST {{base_url}}/patient-records`

**Request Body**:
```json
{
  "patient": "self_id_here",
  "diagnosis": "Self-diagnosed headache",
  "notes": "I have a headache",
  "medications": ["Aspirin"],
  "visitDate": "30-12-2025 11:00"
}
```

**Expected Response**: 403 Forbidden
```json
{
  "message": "Only providers can create patient records"
}
```

### Test Case 3: Patient Viewing Own Records

**Prerequisite**: Login as Patient
**Endpoint**: `GET {{base_url}}/patient-records/my-records`

**Expected Response**: 200 OK
```json
{
  "message": "Records retrieved successfully",
  "records": [
    {
      "_id": "record_id_here",
      "patient": "patient_id_here",
      "diagnosis": "encrypted_data_here",
      "notes": "encrypted_data_here",
      "medications": ["encrypted_data_here"],
      "visitDate": "30-12-2025 10:30",
      "encryptedAesKey": "wrapped_key_here",
      "transitKeyVersion": "key_version_here"
    }
  ]
}
```

### Test Case 4: Provider Viewing Assigned Patient Records

**Prerequisite**: Login as Provider
**Endpoint**: `GET {{base_url}}/patient-records/provider/assigned`

**Expected Response**: 200 OK
```json
{
  "message": "Assigned patient records retrieved successfully",
  "records": [
    {
      "id": "record_id_here",
      "patient": {
        "_id": "patient_id_here",
        "name": "Patient Two",
        "email": "patient2@test.com"
      },
      "diagnosis": "encrypted_data_here",
      "notes": "encrypted_data_here",
      "medications": ["encrypted_data_here"],
      "visitDate": "30-12-2025 10:30",
      "encryptedAesKey": "wrapped_key_here",
      "transitKeyVersion": "key_version_here"
    }
  ]
}
```

### Test Case 5: Unauthorized Record Access

**Scenario**: Provider trying to view record of unassigned patient
**Prerequisite**: Login as Provider
**Endpoint**: `GET {{base_url}}/patient-records/:record_id` (where record belongs to unassigned patient)

**Expected Response**: 403 Forbidden
```json
{
  "message": "Not authorized to view this record"
}
```

## User Update Permissions Testing

### Field-Level Update Permissions

| Role | Can Update These Fields (on others) | Can Update These Fields (self) |
|------|-----------------------------------|-------------------------------|
| Admin | All fields for all roles | All own fields |
| Manager | Patient: name, email, phone, address, dateOfBirth, gender, assignedProviderId<br>Employee: name, email, phone, address, employeeId<br>Provider: name, email, phone, address, providerId, assignedPatients | All own fields |
| Employee | Patient: name, email, phone, address, dateOfBirth, gender, assignedProviderId | All own fields |
| Provider | None (cannot update other users) | All own fields |
| Patient | None (cannot update other users) | phone, address only |

### Test Case 1: Patient Self-Update (Limited Fields)

**Prerequisite**: Login as Patient
**Endpoint**: `PUT {{base_url}}/users/:patient_id`

**Request Body**:
```json
{
  "phone": "555-9999",
  "address": "Updated Address"
}
```

**Expected Response**: 200 OK

### Test Case 2: Patient Trying to Update Name (Forbidden)

**Prerequisite**: Login as Patient
**Endpoint**: `PUT {{base_url}}/users/:patient_id`

**Request Body**:
```json
{
  "name": "Updated Name"
}
```

**Expected Response**: 400 Bad Request (field not allowed for self-update)

### Test Case 3: Manager Updating Employee

**Prerequisite**: Login as Manager
**Endpoint**: `PUT {{base_url}}/users/:employee_id`

**Request Body**:
```json
{
  "name": "Updated Employee Name",
  "phone": "555-8888",
  "employeeId": "EMP-UPDATED"
}
```

**Expected Response**: 200 OK

### Test Case 4: Employee Trying to Update Provider (Forbidden)

**Prerequisite**: Login as Employee
**Endpoint**: `PUT {{base_url}}/users/:provider_id`

**Request Body**:
```json
{
  "phone": "555-7777"
}
```

**Expected Response**: 403 Forbidden

## Complete Testing Workflow

### Step 1: Environment Setup
1. Start the backend server: `npm run dev`
2. Create test users: `npm run create-test-users`
3. Import Postman environment variables
4. Import Postman collection

### Step 2: Authentication Tests
1. Test login for each role
2. Verify token persistence
3. Test logout functionality
4. Test unauthorized access without token

### Step 3: RBAC Registration Tests
1. Test allowed registration scenarios
2. Test forbidden registration scenarios
3. Verify error messages and status codes

### Step 4: Patient Record Tests
1. Create patient records as Provider
2. Test record creation with wrong date format
3. Test unauthorized creation attempts
4. View records as Patient
5. View assigned records as Provider
6. Test unauthorized record access

### Step 5: User Update Tests
1. Test self-updates with allowed fields
2. Test updates by higher roles
3. Test forbidden update attempts
4. Verify field-level restrictions

### Step 6: Edge Cases
1. Test with expired tokens
2. Test with invalid data formats
3. Test rate limiting (if applicable)
4. Test audit logging

## Common Error Scenarios

### 401 Unauthorized
- Missing or invalid authentication token
- Expired JWT token
- No cookie sent with request

### 403 Forbidden
- RBAC violation (wrong role for action)
- Provider trying to access unassigned patient record
- Patient trying to create records

### 400 Bad Request
- Invalid date format (must be `dd-mm-yyyy HH:MM`)
- Missing required fields
- Invalid email format
- Trying to update restricted fields

### 404 Not Found
- User not found
- Record not found
- Patient not assigned to provider

### 409 Conflict
- Duplicate email during registration
- Resource already exists

## Troubleshooting

### Issue: Cookies Not Being Sent
**Solution**: In Postman settings:
1. Go to Settings → General
2. Enable "Send cookies with requests"
3. Disable "SSL certificate verification" for local testing

### Issue: Date Format Errors
**Solution**: Ensure dates are in exact format: `dd-mm-yyyy HH:MM`
- Example: `30-12-2025 14:30`
- Must be today's date for record creation

### Issue: Provider Cannot Create Record
**Solution**: 
1. Verify patient is assigned to provider
2. Check patient ID is correct
3. Ensure visit date is today

### Issue: Test Users Not Created
**Solution**: 
1. Check MongoDB is running
2. Run: `node scripts/createTestUsers.js`
3. Verify users in database: `db.users.find()`

## Test Data Files

The `test/postman-test/` directory contains:
- `test-users.json`: Complete test user data
- `patient-records.json`: Sample patient records
- `rbac-test-cases.json`: Structured test cases
- `postman-collection.json`: Import this into Postman
- `postman-environment.json`: Environment variables

## Automated Testing

For automated testing, you can also use the existing Jest test suite:

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:integration    # API integration tests
npm run test:security       # RBAC security tests
npm run test:coverage       # Generate coverage report
```

## Support

For issues with Postman testing:
1. Check server logs in `/logs/` directory
2. Verify test users exist in database
3. Check MongoDB and OpenBao are running
4. Review audit logs via `/api/admin/audit-logs` (Admin only)

---

*Last Updated: December 30, 2025*  
*Document Version: 1.0*
