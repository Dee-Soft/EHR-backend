#!/bin/bash

# Test error handling for invalid encryption scenarios

set -e

echo "========================================="
echo "Error Handling Tests for Encryption Flow"
echo "========================================="

BACKEND_URL="http://localhost:3001"
TODAY="2025-12-18"  # Using UTC date
PATIENT_ID="6944164f9f7e0cefead0d11a"

# Test 1: Missing x-encrypted-aes-key header
echo ""
echo "Test 1: Missing x-encrypted-aes-key header"
echo "Expected: 400 Bad Request with 'Missing encrypted AES key in headers'"
RESPONSE=$(curl -s -X POST $BACKEND_URL/api/patient-records \
  -H "Content-Type: application/json" \
  -b manager_cookies.txt \
  -d '{
    "patient": "'"$PATIENT_ID"'",
    "diagnosis": "Test",
    "notes": "Test",
    "medications": "[\"Test\"]",
    "visitDate": "'"$TODAY"'"
  }')
echo "Response: $(echo "$RESPONSE" | jq -r '.message')"
echo "Status: $(echo "$RESPONSE" | jq -r '.message' | grep -q 'Missing encrypted AES key' && echo "✓ PASS" || echo "✗ FAIL")"

# Test 2: Invalid wrapped key format
echo ""
echo "Test 2: Invalid wrapped key format"
echo "Expected: 500 with 'Failed to load AES key'"
RESPONSE=$(curl -s -X POST $BACKEND_URL/api/patient-records \
  -H "Content-Type: application/json" \
  -H "x-encrypted-aes-key: invalid-key-format-not-vault-prefix" \
  -b manager_cookies.txt \
  -d '{
    "patient": "'"$PATIENT_ID"'",
    "diagnosis": "Test",
    "notes": "Test",
    "medications": "[\"Test\"]",
    "visitDate": "'"$TODAY"'"
  }')
echo "Response: $(echo "$RESPONSE" | jq -r '.message')"
echo "Status: $(echo "$RESPONSE" | jq -r '.message' | grep -q 'Failed to load AES key' && echo "✓ PASS" || echo "✗ FAIL")"

# Test 3: Wrong date (not today)
echo ""
echo "Test 3: Wrong date (not today)"
echo "Expected: 400 with 'Can only create records for today'"
RESPONSE=$(curl -s -X POST $BACKEND_URL/api/patient-records \
  -H "Content-Type: application/json" \
  -H "x-encrypted-aes-key: vault:v1:test" \
  -b manager_cookies.txt \
  -d '{
    "patient": "'"$PATIENT_ID"'",
    "diagnosis": "Test",
    "notes": "Test",
    "medications": "[\"Test\"]",
    "visitDate": "2024-01-01"
  }')
echo "Response: $(echo "$RESPONSE" | jq -r '.message')"
echo "Status: $(echo "$RESPONSE" | jq -r '.message' | grep -q 'Can only create records for today' && echo "✓ PASS" || echo "✗ FAIL")"

# Test 4: Missing required fields
echo ""
echo "Test 4: Missing required fields"
echo "Expected: 400 with 'All fields are required'"
RESPONSE=$(curl -s -X POST $BACKEND_URL/api/patient-records \
  -H "Content-Type: application/json" \
  -H "x-encrypted-aes-key: vault:v1:test" \
  -b manager_cookies.txt \
  -d '{
    "patient": "'"$PATIENT_ID"'",
    "diagnosis": "Test",
    "visitDate": "'"$TODAY"'"
    # Missing notes and medications
  }')
echo "Response: $(echo "$RESPONSE" | jq -r '.message')"
echo "Status: $(echo "$RESPONSE" | jq -r '.message' | grep -q 'All fields are required' && echo "✓ PASS" || echo "✗ FAIL")"

# Test 5: Employee trying to create record
echo ""
echo "Test 5: Employee trying to create record"
echo "Expected: 403 with 'Only providers and managers can create patient records'"
RESPONSE=$(curl -s -X POST $BACKEND_URL/api/patient-records \
  -H "Content-Type: application/json" \
  -H "x-encrypted-aes-key: vault:v1:test" \
  -b employee_cookies.txt \
  -d '{
    "patient": "'"$PATIENT_ID"'",
    "diagnosis": "Test",
    "notes": "Test",
    "medications": "[\"Test\"]",
    "visitDate": "'"$TODAY"'"
  }')
echo "Response: $(echo "$RESPONSE" | jq -r '.message')"
echo "Status: $(echo "$RESPONSE" | jq -r '.message' | grep -q 'Only providers and managers can create patient records' && echo "✓ PASS" || echo "✗ FAIL")"

# Test 6: Provider trying to create record for unassigned patient
echo ""
echo "Test 6: Provider trying to create record for unassigned patient"
echo "Expected: 403 with 'Provider can only create records for assigned patients'"
RESPONSE=$(curl -s -X POST $BACKEND_URL/api/patient-records \
  -H "Content-Type: application/json" \
  -H "x-encrypted-aes-key: vault:v1:test" \
  -b provider_cookies.txt \
  -d '{
    "patient": "'"$PATIENT_ID"'",
    "diagnosis": "Test",
    "notes": "Test",
    "medications": "[\"Test\"]",
    "visitDate": "'"$TODAY"'"
  }')
echo "Response: $(echo "$RESPONSE" | jq -r '.message')"
echo "Status: $(echo "$RESPONSE" | jq -r '.message' | grep -q 'Provider can only create records for assigned patients' && echo "✓ PASS" || echo "✗ FAIL")"

# Test 7: Invalid encrypted data (not vault:v1: format)
echo ""
echo "Test 7: Invalid encrypted data format"
echo "Expected: 500 with 'Failed to decrypt fields' or similar"
# First get a valid encrypted AES key
VALID_KEY=$(curl -s -X POST -H "X-Vault-Token: ehr-permanent-token" -d '{"plaintext":"test"}' http://localhost:18200/v1/transit/encrypt/ehr-rsa-exchange 2>/dev/null | jq -r '.data.ciphertext' || echo "vault:v1:test")
RESPONSE=$(curl -s -X POST $BACKEND_URL/api/patient-records \
  -H "Content-Type: application/json" \
  -H "x-encrypted-aes-key: $VALID_KEY" \
  -b manager_cookies.txt \
  -d '{
    "patient": "'"$PATIENT_ID"'",
    "diagnosis": "not-encrypted-plaintext",
    "notes": "not-encrypted-plaintext",
    "medications": "not-encrypted-plaintext",
    "visitDate": "'"$TODAY"'"
  }')
echo "Response: $(echo "$RESPONSE" | jq -r '.message // .error // "Unknown"')"
echo "Status: $(echo "$RESPONSE" | jq -r '.message' | grep -q 'Failed to decrypt' && echo "✓ PASS" || echo "✗ FAIL")"

echo ""
echo "========================================="
echo "Summary"
echo "========================================="
echo "Error handling tests completed."
echo "These tests verify that the system properly validates:"
echo "1. Required encryption headers"
echo "2. Valid key formats"
echo "3. Date validation"
echo "4. Required field validation"
echo "5. Role-based authorization"
echo "6. Provider-patient assignment"
echo "7. Encrypted data format validation"
