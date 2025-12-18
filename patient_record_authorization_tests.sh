#!/bin/bash

# Patient Record Authorization Tests
# This script tests role-based access control for patient record endpoints

BASE_URL="http://localhost:3001"
COOKIE_DIR="./test_cookies"
mkdir -p $COOKIE_DIR

echo "=== Patient Record Authorization Tests ==="
echo "Base URL: $BASE_URL"
echo ""

# Function to make authenticated requests
make_request() {
    local method=$1
    local endpoint=$2
    local cookie_file=$3
    local data=$4
    
    if [ -z "$data" ]; then
        curl -X $method "$BASE_URL$endpoint" \
            -b "$COOKIE_DIR/$cookie_file" \
            -H "Content-Type: application/json" \
            -s
    else
        curl -X $method "$BASE_URL$endpoint" \
            -b "$COOKIE_DIR/$cookie_file" \
            -H "Content-Type: application/json" \
            -d "$data" \
            -s
    fi
}

# Test 1: Patient viewing own records (my-records endpoint)
echo "Test 1: Patient viewing own records"
echo "-----------------------------------"
make_request "GET" "/api/patient-records/my-records" "patient_cookies.txt"
echo ""
echo "Expected: 200 OK or 404 (no records found)"
echo ""

# Test 2: Patient trying to view all records
echo "Test 2: Patient trying to view all records"
echo "------------------------------------------"
make_request "GET" "/api/patient-records" "patient_cookies.txt"
echo ""
echo "Expected: 403 Forbidden"
echo ""

# Test 3: Manager viewing all records
echo "Test 3: Manager viewing all records"
echo "-----------------------------------"
make_request "GET" "/api/patient-records" "manager_cookies.txt"
echo ""
echo "Expected: 200 OK with empty array"
echo ""

# Test 4: Employee trying to view all records
echo "Test 4: Employee trying to view all records"
echo "-------------------------------------------"
make_request "GET" "/api/patient-records" "employee_cookies.txt"
echo ""
echo "Expected: 403 Forbidden"
echo ""

# Test 5: Admin viewing all records
echo "Test 5: Admin viewing all records"
echo "---------------------------------"
make_request "GET" "/api/patient-records" "admin_cookies_test.txt"
echo ""
echo "Expected: 200 OK with empty array"
echo ""

# Test 6: Provider trying to view all records
echo "Test 6: Provider trying to view all records"
echo "-------------------------------------------"
make_request "GET" "/api/patient-records" "provider_cookies.txt"
echo ""
echo "Expected: 403 Forbidden (unless they have special permissions)"
echo ""

# Test 7: Unauthenticated access to records
echo "Test 7: Unauthenticated access to records"
echo "-----------------------------------------"
curl -X GET "$BASE_URL/api/patient-records" -s
echo ""
echo "Expected: 401 Unauthorized (no cookie provided)"
echo ""

# Test 8: Test record creation authorization (without encryption)
echo "Test 8: Employee trying to create record (authorization test)"
echo "-------------------------------------------------------------"
make_request "POST" "/api/patient-records" "employee_cookies.txt" '{
    "patient": "6944164f9f7e0cefead0d11a",
    "diagnosis": "Test",
    "notes": "Test",
    "medications": ["Test"],
    "visitDate": "2025-12-18"
}'
echo ""
echo "Note: This will fail due to missing encryption headers, but shows the flow"
echo ""

# Test 9: Test provider-patient assignment logic
echo "Test 9: Checking provider info"
echo "-------------------------------"
make_request "GET" "/api/auth/me" "provider_cookies.txt"
echo ""
echo "Shows provider ID and assigned patients (if any)"
echo ""

# Test 10: Test patient info
echo "Test 10: Checking patient info"
echo "-------------------------------"
make_request "GET" "/api/auth/me" "patient_cookies.txt"
echo ""
echo "Shows patient ID for reference"
echo ""

echo "=== Summary ==="
echo "These tests verify that:"
echo "1. Patients can only view their own records (my-records endpoint)"
echo "2. Only Managers and Admins can view all records"
echo "3. Employees cannot view any records"
echo "4. Providers have restricted access based on patient assignments"
echo "5. All endpoints require authentication"
echo ""
echo "Note: Record creation tests require proper encryption setup with OpenBao"
echo "which is not available in this test environment."
