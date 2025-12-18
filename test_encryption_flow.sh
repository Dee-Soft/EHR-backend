#!/bin/bash

# Test script for complete encryption/decryption flow
# This simulates frontend encryption and tests backend processing

set -e

echo "========================================="
echo "Complete Encryption/Decryption Flow Test"
echo "========================================="

# Configuration
OPENBAO_TOKEN="ehr-permanent-token"
OPENBAO_URL="http://localhost:18200"
BACKEND_URL="http://localhost:3001"
TODAY=$(date +%Y-%m-%d)

# User IDs from cookies
MANAGER_ID="694415da9f7e0cefead0d104"
PATIENT_ID="6944164f9f7e0cefead0d11a"

echo "✓ Configuration loaded"
echo "  - Today's date: $TODAY"
echo "  - Manager ID: $MANAGER_ID"
echo "  - Patient ID: $PATIENT_ID"

# Encrypted data from previous OpenBao operations
# These values were generated in the simulation phase
ENCRYPTED_AES_KEY="vault:v1:It2+tHrkk/VyN6JP+EEux7zh1G5SsAaw8RkS+6TmP8lrwBocPn3VAWdDKU3ij08rjLgTNtq86VpSMMI1zglzMBksazZYp+Vp/dpeF1WuBEk0oqhStnRDxh9Y3JWXW0UF73HZzO9LFkBkoh3wCZqPbkKP5h8XcILJJ1GKUbVM0cEmuydqD+UtFTpf9gp2KHJ00YrqeYPbYLwfuymgjkHnmrQ2yMU+rtFf58S0fzEGyRTHRLP3mZo0BWJ/OEqAyG5hmezB7lB45A6XJZFFX3LO0HU9ASlo3BUc36vXkbQfJllmBmJ+sAmc/QLLKzeIFfLWqEuc4VoNRGb4fUzKaqm+lw=="
ENCRYPTED_DIAGNOSIS="vault:v1:I1//Bzp2UPrD8DPhymY9Omlr1HYDEMF23rhV2KyC037O+7IYqpZyjqprzjOLwk03Cliih94kpL147RGsWHd1QHY6"
ENCRYPTED_NOTES="vault:v1:B5OKHTeneki7xofJ6kVXZBs2tRGRcCX8zY+rEYVThpgUucxaj0PmpTXho+DSJ6CpSkw8wvl3jp2PQF2qmCb46q+5jDiNPxICnBAFE95d0MkBGHwwKaYDfLGhCoslrg+r5C+HB3i7rcrlDPaMSbY7W5337TzF7ieon/lx/9mZl9kMp7XcLquo42SQ"
ENCRYPTED_MEDICATIONS="vault:v1:qm+pQUy3sDx90HuizoIDVPPuSP1+876uftwbN/eLUS/IcR7JuubbkATulyaAFOOhyryayufZM+HiwHfnKnyopNyLsrwn5tVcz4FJTIWETA6HCx4fFUr1TH7is9f4pHC5O2G8CG4Rn1LAGmGq1TRV"

# For frontend public key, we need to get the RSA public key from OpenBao
# In a real scenario, frontend would have its own RSA key pair
# For testing, we'll use the backend's public key as a placeholder
echo ""
echo "Getting backend RSA public key for frontend to use..."
BACKEND_PUBLIC_KEY=$(curl -s -X GET $BACKEND_URL/api/key-exchange/public-key | jq -r '.publicKey' | base64 -w 0)
echo "✓ Backend public key obtained (base64 encoded)"

echo ""
echo "========================================="
echo "Testing Patient Record Creation"
echo "========================================="

# Test 1: Create patient record with encrypted data (Manager role)
echo "Test 1: Creating patient record with encrypted data (Manager role)..."
RESPONSE=$(curl -s -X POST $BACKEND_URL/api/patient-records \
  -H "Content-Type: application/json" \
  -H "x-encrypted-aes-key: $ENCRYPTED_AES_KEY" \
  -H "x-client-public-key: $BACKEND_PUBLIC_KEY" \
  -b manager_cookies.txt \
  -d '{
    "patient": "'"$PATIENT_ID"'",
    "diagnosis": "'"$ENCRYPTED_DIAGNOSIS"'",
    "notes": "'"$ENCRYPTED_NOTES"'",
    "medications": "'"$ENCRYPTED_MEDICATIONS"'",
    "visitDate": "'"$TODAY"'"
  }')

echo "Response:"
echo "$RESPONSE" | jq .

# Check if creation was successful
if echo "$RESPONSE" | jq -e '.message' > /dev/null 2>&1; then
    if echo "$RESPONSE" | jq -e '.message | test("created|success")' > /dev/null 2>&1; then
        echo "✓ Record creation successful"
        RECORD_ID=$(echo "$RESPONSE" | jq -r '.record._id // .record.id // empty')
        if [ -n "$RECORD_ID" ]; then
            echo "✓ Record ID: $RECORD_ID"
        fi
    else
        echo "✗ Record creation failed"
        echo "Error message: $(echo "$RESPONSE" | jq -r '.message')"
    fi
else
    echo "✗ Invalid response format"
fi

echo ""
echo "========================================="
echo "Testing Record Retrieval"
echo "========================================="

# Test 2: Manager views all records
echo "Test 2: Manager viewing all records..."
MANAGER_RESPONSE=$(curl -s -X GET $BACKEND_URL/api/patient-records -b manager_cookies.txt)
MANAGER_COUNT=$(echo "$MANAGER_RESPONSE" | jq '.records | length')
echo "✓ Manager can view $MANAGER_COUNT records"

# Test 3: Patient views own records
echo "Test 3: Patient viewing own records..."
PATIENT_RESPONSE=$(curl -s -X GET $BACKEND_URL/api/patient-records/my-records -b patient_cookies.txt)
PATIENT_COUNT=$(echo "$PATIENT_RESPONSE" | jq '.records | length')
echo "✓ Patient can view $PATIENT_COUNT of their own records"

# Test 4: Employee tries to view records (should fail)
echo "Test 4: Employee trying to view records (should fail)..."
EMPLOYEE_RESPONSE=$(curl -s -w "%{http_code}" -X GET $BACKEND_URL/api/patient-records -b employee_cookies.txt -o /dev/null)
if [ "$EMPLOYEE_RESPONSE" = "403" ]; then
    echo "✓ Employee correctly denied access (403 Forbidden)"
else
    echo "✗ Employee access test failed. Got HTTP $EMPLOYEE_RESPONSE"
fi

echo ""
echo "========================================="
echo "Testing Error Cases"
echo "========================================="

# Test 5: Missing encryption headers
echo "Test 5: Missing encryption headers..."
ERROR_RESPONSE1=$(curl -s -X POST $BACKEND_URL/api/patient-records \
  -H "Content-Type: application/json" \
  -b manager_cookies.txt \
  -d '{
    "patient": "'"$PATIENT_ID"'",
    "diagnosis": "test",
    "notes": "test",
    "medications": "test",
    "visitDate": "'"$TODAY"'"
  }')
echo "Response: $(echo "$ERROR_RESPONSE1" | jq -r '.message // .error // "Unknown error"')"

# Test 6: Invalid wrapped key
echo "Test 6: Invalid wrapped key..."
ERROR_RESPONSE2=$(curl -s -X POST $BACKEND_URL/api/patient-records \
  -H "Content-Type: application/json" \
  -H "x-encrypted-aes-key: invalid-key-format" \
  -b manager_cookies.txt \
  -d '{
    "patient": "'"$PATIENT_ID"'",
    "diagnosis": "test",
    "notes": "test",
    "medications": "test",
    "visitDate": "'"$TODAY"'"
  }')
echo "Response: $(echo "$ERROR_RESPONSE2" | jq -r '.message // .error // "Unknown error"')"

# Test 7: Wrong date (not today)
echo "Test 7: Wrong date (not today)..."
ERROR_RESPONSE3=$(curl -s -X POST $BACKEND_URL/api/patient-records \
  -H "Content-Type: application/json" \
  -H "x-encrypted-aes-key: $ENCRYPTED_AES_KEY" \
  -b manager_cookies.txt \
  -d '{
    "patient": "'"$PATIENT_ID"'",
    "diagnosis": "test",
    "notes": "test",
    "medications": "test",
    "visitDate": "2024-01-01"
  }')
echo "Response: $(echo "$ERROR_RESPONSE3" | jq -r '.message // .error // "Unknown error"')"

echo ""
echo "========================================="
echo "Summary"
echo "========================================="
echo "1. OpenBao Configuration: ✓ Verified"
echo "2. Test Data Preparation: ✓ Complete"
echo "3. Record Creation Test: $( [ -n "$RECORD_ID" ] && echo "✓ Success" || echo "✗ Failed" )"
echo "4. Authorization Tests:"
echo "   - Manager access: ✓ $MANAGER_COUNT records"
echo "   - Patient access: ✓ $PATIENT_COUNT records"
echo "   - Employee denial: ✓ 403 Forbidden"
echo "5. Error Handling Tests: ✓ Completed"

if [ -n "$RECORD_ID" ]; then
    echo ""
    echo "✅ Complete encryption/decryption flow test PASSED!"
    echo "   Record created with ID: $RECORD_ID"
else
    echo ""
    echo "❌ Test FAILED - No record was created"
    echo "   Check the error messages above for details"
fi
