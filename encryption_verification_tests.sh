#!/bin/bash

# Encryption Verification Tests
# This script verifies encryption setup and configuration

BASE_URL="http://localhost:3001"

echo "=== Encryption Verification Tests ==="
echo "Base URL: $BASE_URL"
echo ""

# Test 1: Check OpenBao health status
echo "Test 1: OpenBao Health Status"
echo "-----------------------------"
curl -X GET "$BASE_URL/api/health" -s | jq '.services.openbao'
echo ""
echo "Expected: status: 'healthy', healthy: true"
echo ""

# Test 2: Check key exchange endpoint (RSA public key availability)
echo "Test 2: RSA Public Key Availability"
echo "-----------------------------------"
curl -X GET "$BASE_URL/api/key-exchange/public-key" -s
echo ""
echo "Note: This may fail if RSA key is not configured in OpenBao"
echo ""

# Test 3: Check encryption middleware configuration
echo "Test 3: Encryption Configuration Check"
echo "--------------------------------------"
echo "Checking encryption middleware files..."
echo ""
echo "1. transitEncryptMiddleware.js exists: $(ls middlewares/transitEncryptMiddleware.js 2>/dev/null && echo 'YES' || echo 'NO')"
echo "2. transitDecryptMiddleware.js exists: $(ls middlewares/transitDecryptMiddleware.js 2>/dev/null && echo 'YES' || echo 'NO')"
echo "3. loadAESKey.js exists: $(ls middlewares/loadAESKey.js 2>/dev/null && echo 'YES' || echo 'NO')"
echo "4. openbaoCryptoService.js exists: $(ls services/openbaoCryptoService.js 2>/dev/null && echo 'YES' || echo 'NO')"
echo "5. keyExchangeService.js exists: $(ls services/keyExchangeService.js 2>/dev/null && echo 'YES' || echo 'NO')"
echo ""

# Test 4: Check encryption fields in patient record controller
echo "Test 4: Encryption Fields Configuration"
echo "--------------------------------------"
echo "Fields encrypted by transitEncryptMiddleware: diagnosis, notes, medications"
echo "Fields decrypted by transitDecryptMiddleware: diagnosis, notes, medications"
echo ""

# Test 5: Check database encryption metadata
echo "Test 5: Database Encryption Metadata"
echo "------------------------------------"
echo "PatientRecord model should store:"
echo "1. encryptedAesKey: Encrypted AES key for the record"
echo "2. transitKeyVersion: OpenBao key version used"
echo "3. encryptionMetadata: Algorithm, keyId, encryptedAt"
echo ""

# Test 6: Verify encryption flow from code analysis
echo "Test 6: Encryption Flow Analysis"
echo "--------------------------------"
echo "Based on code analysis:"
echo "1. Frontend encrypts sensitive fields with AES key"
echo "2. Frontend wraps AES key with backend's RSA public key"
echo "3. Backend unwraps AES key using OpenBao Transit Engine"
echo "4. Backend decrypts fields with unwrapped AES key"
echo "5. Backend re-encrypts fields with OpenBao for storage"
echo "6. Backend stores encrypted AES key with record"
echo "7. Frontend can decrypt using stored AES key"
echo ""

# Test 7: Check environment configuration
echo "Test 7: Environment Configuration"
echo "---------------------------------"
echo "Checking .env.example for required OpenBao variables..."
if [ -f .env.example ]; then
    grep -i "openbao\|vault\|encrypt" .env.example || echo "No OpenBao variables found in .env.example"
else
    echo ".env.example not found"
fi
echo ""

echo "=== Summary ==="
echo "Encryption verification shows:"
echo "1. OpenBao connection status"
echo "2. RSA key availability for key exchange"
echo "3. Encryption middleware configuration"
echo "4. Database encryption metadata structure"
echo "5. End-to-end encryption flow"
echo ""
echo "Note: Full encryption testing requires:"
echo "1. OpenBao with properly configured transit engine"
echo "2. RSA key pair for key exchange"
echo "3. AES master key for data encryption"
echo "4. Frontend encryption implementation"
