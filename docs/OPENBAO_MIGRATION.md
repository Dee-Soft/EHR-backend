# OpenBao Secret Management Migration Guide

## Overview

This document describes the migration from local file-based key management to OpenBao Transit Engine for centralized secret management in the EHR backend system.

## Why OpenBao?

### Previous Architecture (File-Based)
- **Local Key Generation**: RSA and AES keys generated and stored in files
- **Manual Key Rotation**: Cron job to rotate keys daily
- **Security Risks**: Keys stored on filesystem, potential exposure
- **Scalability Issues**: Difficult to manage keys across multiple instances
- **No Audit Trail**: Limited visibility into key usage

### New Architecture (OpenBao Transit Engine)
- **Centralized Key Management**: All keys managed by OpenBao
- **Automatic Key Rotation**: OpenBao handles rotation with versioning
- **Enhanced Security**: Keys never leave OpenBao, only ciphertext
- **High Availability**: OpenBao clustering for production
- **Complete Audit Trail**: All crypto operations logged
- **Compliance Ready**: Meets HIPAA and other regulatory requirements

## Architecture Changes

### Encryption Flow

```
OLD FLOW:
Frontend → [Backend RSA Decrypt] → [Backend AES Encrypt] → Database

NEW FLOW:
Frontend → [OpenBao RSA Unwrap] → [OpenBao Transit Encrypt] → Database
```

### Key Components

#### 1. OpenBao Configuration (`config/openbao.config.js`)
- Manages connection to OpenBao server
- Handles AppRole authentication for production
- Provides retry logic with exponential backoff
- Health check integration

#### 2. Crypto Service (`services/openbaoCryptoService.js`)
- Replaces: `utils/aesUtils.js`, `helpers/cryptoHelper.js`
- Handles all data encryption/decryption via Transit Engine
- Manages data key generation (envelope encryption)
- Supports key rotation and re-encryption

#### 3. Key Exchange Service (`services/keyExchangeService.js`)
- Replaces: `utils/rsaUtils.js`, `config/keyManager.js`
- Manages RSA key pairs for frontend-backend exchange
- Wraps/unwraps AES keys using OpenBao Transit
- No local key storage

#### 4. Transit Middlewares
- `middlewares/transitEncryptMiddleware.js` (replaces `encryptFieldsAESMiddleware.js`)
- `middlewares/transitDecryptMiddleware.js` (replaces `decryptFieldsAESMiddleware.js`)
- `middlewares/loadAESKey.js` (refactored to use OpenBao)

## Deployment Requirements

### Environment Variables

```bash
# OpenBao Connection
OPENBAO_ADDR=http://openbao:8200
OPENBAO_TOKEN=s.JfR6axjtdGedQeblSsppTMds  # Dev only

# Production: Use AppRole
OPENBAO_ROLE_ID=your-role-id
OPENBAO_SECRET_ID=your-secret-id

# Transit Key Names
OPENBAO_TRANSIT_AES_KEY=ehr-aes-master
OPENBAO_TRANSIT_RSA_KEY=ehr-rsa-exchange
```

### OpenBao Setup

#### 1. Initialize OpenBao (Development)

```bash
# Start OpenBao container
docker-compose up -d openbao

# Initialize and unseal (if not auto-unsealed)
docker exec -it openbao bao operator init
docker exec -it openbao bao operator unseal
```

#### 2. Create Transit Keys

```bash
# Enable Transit Engine
bao secrets enable transit

# Create AES master key for data encryption
bao write -f transit/keys/ehr-aes-master \
  type=aes256-gcm96 \
  exportable=false \
  allow_plaintext_backup=false

# Create RSA key for frontend-backend exchange
bao write -f transit/keys/ehr-rsa-exchange \
  type=rsa-2048 \
  exportable=false
```

#### 3. Configure Key Rotation (Production)

```bash
# Enable automatic rotation every 30 days
bao write transit/keys/ehr-aes-master/config \
  auto_rotate_period=720h

bao write transit/keys/ehr-rsa-exchange/config \
  auto_rotate_period=720h
```

#### 4. Create AppRole for Backend (Production)

```bash
# Enable AppRole auth
bao auth enable approle

# Create policy for backend
bao policy write backend-policy - <<EOF
path "transit/encrypt/ehr-*" {
  capabilities = ["update"]
}
path "transit/decrypt/ehr-*" {
  capabilities = ["update"]
}
path "transit/datakey/plaintext/ehr-*" {
  capabilities = ["update"]
}
path "transit/keys/ehr-*" {
  capabilities = ["read"]
}
EOF

# Create AppRole
bao write auth/approle/role/ehr-backend \
  token_policies="backend-policy" \
  token_ttl=1h \
  token_max_ttl=4h

# Get credentials
bao read auth/approle/role/ehr-backend/role-id
bao write -f auth/approle/role/ehr-backend/secret-id
```

## Migration Steps

### Step 1: Backup Existing Data (If Production)

```bash
# Export existing encrypted records
mongodump --db=ehr-system --collection=patientrecords --out=backup/

# Store old encryption keys securely
cp config/keys/* backup/keys/
```

### Step 2: Deploy OpenBao

```bash
# Using docker-compose
docker-compose -f docker-compose-secrets.yml up -d

# Verify OpenBao is running
curl http://localhost:8200/v1/sys/health
```

### Step 3: Setup Transit Keys

Follow "OpenBao Setup" section above to create transit keys.

### Step 4: Update Backend Code

```bash
# Pull latest code with OpenBao integration
git pull origin main

# Install dependencies (node-vault added)
npm install

# Update environment variables
cp .env.example .env
# Edit .env with your OpenBao credentials
```

### Step 5: Test Integration

```bash
# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Run security tests
npm run test:security

# Check coverage
npm run test:coverage
```

### Step 6: Data Migration (If Needed)

If you have existing encrypted records with old keys:

```javascript
// scripts/migrateToOpenBao.js
const cryptoService = require('./services/openbaoCryptoService');
const PatientRecord = require('./models/PatientRecord');

async function migrateRecords() {
  const records = await PatientRecord.find({});
  
  for (const record of records) {
    // Decrypt with old key
    const plainDiagnosis = oldDecrypt(record.diagnosis);
    const plainNotes = oldDecrypt(record.notes);
    const plainMeds = oldDecrypt(record.medications);
    
    // Encrypt with OpenBao
    const newDiagnosis = await cryptoService.encryptData(plainDiagnosis);
    const newNotes = await cryptoService.encryptData(plainNotes);
    const newMeds = await cryptoService.encryptData(plainMeds);
    
    // Update record
    record.diagnosis = newDiagnosis.ciphertext;
    record.notes = newNotes.ciphertext;
    record.medications = newMeds.ciphertext;
    record.transitKeyVersion = 1;
    record.encryptionMetadata = {
      algorithm: 'aes256-gcm96',
      keyId: 'ehr-aes-master',
      encryptedAt: new Date()
    };
    
    await record.save();
  }
}
```

### Step 7: Deploy to Production

```bash
# Build and deploy
npm run build
npm start

# Monitor logs for OpenBao connection
tail -f logs/application.log | grep OpenBao

# Check health endpoint
curl http://localhost:5000/api/health
```

## Testing Strategy

### Unit Tests
- Mock OpenBao responses using `test/setup/mocks/openbaoMock.js`
- Test crypto service operations
- Test key exchange service
- Test middleware encryption/decryption

### Integration Tests
- Use real OpenBao instance in Docker
- Test full request/response cycle
- Test key exchange flow
- Test RBAC with encrypted data

### Security Tests
- Verify encryption strength
- Test key versioning
- Validate no plaintext exposure
- Test error handling

## Rollback Strategy

If issues arise during migration:

### Immediate Rollback

```bash
# Revert to previous version
git checkout <previous-commit>
npm install
npm start

# Restore old keys
cp backup/keys/* config/keys/
```

### Data Rollback

```bash
# Restore database from backup
mongorestore --db=ehr-system backup/ehr-system/
```

## Monitoring & Maintenance

### Health Checks

```bash
# Check OpenBao status
curl http://localhost:8200/v1/sys/health

# Check backend health (includes OpenBao)
curl http://localhost:5000/api/health
```

### Key Rotation

OpenBao handles automatic rotation. To manually rotate:

```bash
# Rotate AES master key
bao write -f transit/keys/ehr-aes-master/rotate

# Rotate RSA exchange key
bao write -f transit/keys/ehr-rsa-exchange/rotate
```

### Audit Logs

```bash
# Enable audit logging in OpenBao
bao audit enable file file_path=/vault/logs/audit.log

# View crypto operations
tail -f /vault/logs/audit.log | grep transit
```

## Performance Considerations

### Latency
- OpenBao adds ~10-50ms per crypto operation
- Use connection pooling to minimize overhead
- Cache public keys when possible

### Throughput
- OpenBao can handle 1000+ ops/sec per instance
- Scale horizontally with OpenBao clustering
- Monitor with Prometheus/Grafana

### Optimization Tips
1. Batch encrypt/decrypt operations when possible
2. Use data key caching for repeated operations
3. Implement circuit breaker for OpenBao failures
4. Use async operations to avoid blocking

## Security Best Practices

### Development
- ✅ Use root token only in development
- ✅ Rotate tokens regularly
- ✅ Never commit tokens to git
- ✅ Use `.env` files (gitignored)

### Production
- ✅ Use AppRole authentication
- ✅ Enable TLS for OpenBao communication
- ✅ Implement least-privilege policies
- ✅ Enable audit logging
- ✅ Regular security audits
- ✅ Backup unseal keys securely
- ✅ Use auto-unseal with cloud KMS

## Troubleshooting

### OpenBao Connection Failed

```bash
# Check OpenBao is running
docker ps | grep openbao

# Check logs
docker logs openbao

# Verify network connectivity
curl http://openbao:8200/v1/sys/health
```

### Encryption Fails

```bash
# Verify transit keys exist
bao list transit/keys

# Check key permissions
bao token capabilities transit/encrypt/ehr-aes-master
```

### Performance Issues

```bash
# Check OpenBao metrics
curl http://localhost:8200/v1/sys/metrics

# Monitor backend logs
tail -f logs/application.log | grep "Encryption\|Decryption"
```

## Support & Resources

- **OpenBao Documentation**: https://openbao.org/docs/
- **Transit Engine Guide**: https://openbao.org/docs/secrets/transit/
- **GitHub Repository**: https://github.com/Dee-Soft/EHR-secret-management
- **Team Contact**: [Your team contact info]

## Compliance Notes

### HIPAA Compliance
- ✅ Encryption at rest (OpenBao Transit)
- ✅ Encryption in transit (TLS)
- ✅ Access controls (AppRole + policies)
- ✅ Audit logging (OpenBao audit logs)
- ✅ Key rotation (automatic)

### Data Retention
- Encrypted data remains in MongoDB
- OpenBao keys versioned (old versions retained)
- Audit logs retained per policy

## Changelog

### Version 2.0.0 - OpenBao Migration
- **Added**: OpenBao Transit Engine integration
- **Added**: Centralized key management
- **Added**: Automatic key rotation
- **Removed**: Local file-based key storage
- **Removed**: Manual key rotation cron
- **Changed**: All crypto operations via OpenBao
- **Changed**: Enhanced security and compliance

---

**Last Updated**: December 2024  
**Migration Status**: ✅ Complete  
**Next Review**: Q1 2025

