# EHR Backend Configuration Guide

This document describes the configuration for EHR Backend integration with the EHR Keys Management System.

## Overview

The configuration is designed to:
1. Use environment variables from `.env` files instead of hardcoded values in Docker Compose
2. Connect to the EHR Keys Management System via the `ehr-keys-management-system_ehr-keys-net` network
3. Support different environments (development, test, production)
4. Provide proper fallback behavior for OpenBao connectivity

## Environment Files

### `env.example`
Template file with all required environment variables and documentation.
**Copy this to `.env` and update values for your environment.**

### `.env` (not in version control)
Development and production environment variables. Contains sensitive credentials.
Used by both `docker-compose.yml` (production) and `docker-compose.dev.yml` (development).

### `.env.test`
Test environment variables for running integration tests with mocked OpenBao.

## Docker Compose Files

### `docker-compose.yml` - Production
- Connects to `ehr-keys-management-system_ehr-keys-net` external network
- Uses `.env` file for environment variables
- Uses `openbao:8200` for container-to-container communication

### `docker-compose.dev.yml` - Development  
- Connects to `ehr-keys-management-system_ehr-keys-net` external network
- Uses `.env` file for environment variables (Note: Previously used `.env.dev`, now updated to use `.env`)
- Includes hot reload with volume mounts
- Uses `openbao:8200` for container-to-container communication

### `docker-compose.test.yml` - Testing
- Uses `.env.test` file for environment variables
- Uses mocked OpenBao for isolated testing
- Does not connect to external networks

## Network Configuration

The EHR Backend connects to the EHR Keys Management System via the `ehr-keys-management-system_ehr-keys-net` network:

```yaml
networks:
  ehr-keys-net:
    external: true
    name: ehr-keys-management-system_ehr-keys-net
```

**Prerequisite**: The EHR Keys Management System must be running with the `ehr-keys-management-system_ehr-keys-net` network.

## OpenBao Configuration

The `config/openbao.config.js` is configured to:
- Use dual-key architecture with separate RSA and AES keys for frontend and backend
- Prioritize environment variables from `.env` files
- Support multiple endpoint fallbacks with automatic retry:
  1. `OPENBAO_ADDR` environment variable (highest priority)
  2. `http://openbao:8200` (Docker network communication)
  3. `http://localhost:18200` (local development fallback)
- Provide detailed logging for connection attempts and failures
- Implement exponential backoff retry logic (3 attempts per endpoint)

### Dual-Key Architecture
The system uses separate cryptographic keys for frontend and backend operations:
- **Backend RSA Key**: Used by backend to unwrap AES keys sent by frontend
- **Frontend RSA Key**: Used by backend to wrap AES keys for frontend to decrypt
- **Backend AES Key**: Used by backend for encrypting/decrypting patient data
- **Frontend AES Key**: Used by frontend for its own encryption operations

## Setup Instructions

### 1. Initial Setup
```bash
# Copy environment template (env.example now exists)
cp env.example .env

# Edit .env file with your values
# Update OPENBAO_ADDR, OPENBAO_TOKEN, JWT_SECRET, etc.

# Important configuration notes:
# - For local development without external OpenBao: Use OPENBAO_ADDR=http://localhost:18200
# - For Docker network with EHR Keys Management System: Use OPENBAO_ADDR=http://openbao:8200
# - The server will automatically try both endpoints with retry logic

# For testing, .env.test is already configured with mocked OpenBao
```

### 2. Start Development Environment
```bash
# Option 1: Using helper script (recommended)
./scripts/start-dev.sh

# Option 2: Direct Docker Compose
docker-compose -f docker-compose.dev.yml up

# Option 3: In background
docker-compose -f docker-compose.dev.yml up -d
```

### 3. Run Tests
```bash
# Option 1: Run all tests in Docker (with coverage)
./scripts/run-tests-docker.sh

# Option 2: Run specific test types in Docker
npm run test:docker:integration
npm run test:docker:unit
npm run test:docker:security

# Option 3: Run tests locally
./scripts/run-tests-local.sh --integration
./scripts/run-tests-local.sh --unit --coverage
./scripts/run-tests-local.sh --security

# Option 4: Direct Docker Compose
docker-compose -f docker-compose.test.yml up --build --abort-on-container-exit
```

### 4. Production Deployment
```bash
# Build and run production containers
docker-compose up -d
```

### 5. Helper Scripts
- `./scripts/check-network.sh` - Check Docker network connectivity
- `./scripts/start-dev.sh` - Start development environment with validation
- `./scripts/run-tests-docker.sh` - Run all tests in Docker containers
- `./scripts/run-tests-local.sh` - Run tests locally with options
- `./scripts/test-simple.sh` - Verify Docker test infrastructure

## Environment Variables Reference

### Required Variables
- `OPENBAO_ADDR`: OpenBao API address (e.g., `http://openbao:8200`)
- `OPENBAO_TOKEN`: OpenBao authentication token
- `OPENBAO_TRANSIT_AES_BACKEND_KEY`: Backend AES key name in OpenBao transit engine
- `OPENBAO_TRANSIT_AES_FRONTEND_KEY`: Frontend AES key name in OpenBao transit engine
- `OPENBAO_TRANSIT_RSA_BACKEND_KEY`: Backend RSA key name in OpenBao transit engine
- `OPENBAO_TRANSIT_RSA_FRONTEND_KEY`: Frontend RSA key name in OpenBao transit engine
- `JWT_SECRET`: Secret for JWT token generation
- `MONGO_URI`: MongoDB connection string

### Optional Variables
- `NODE_ENV`: Environment (development, production, test)
- `PORT`: Server port (default: 3001)
- `FRONTEND_URL`: Frontend URL for CORS
- `LOG_LEVEL`: Logging level (debug, info, warn, error)
- `OPENBAO_ROLE_ID`, `OPENBAO_SECRET_ID`: AppRole authentication (production)

## Troubleshooting

### Common Docker Compose Issues

#### "network ehr-keys-management-system_ehr-keys-net declared as external, but could not be found"
This error occurs when Docker Compose cannot find the external network. Solutions:

1. **Check if network exists:**
   ```bash
   ./scripts/check-network.sh
   ```

2. **If network doesn't exist:**
   - Ensure EHR Keys Management System is running (it creates this network)
   - Or create a local network for development:
     ```bash
     docker network create ehr-keys-management-system_ehr-keys-net
     ```

3. **Update .env file for local development (recommended):**
   ```bash
   # In .env file, change:
   OPENBAO_ADDR=http://localhost:18200
   OPENBAO_TOKEN=ehr-permanent-token
   # This allows the server to start without the external network
   # The server will show warnings about OpenBao connectivity but will run
   ```

### OpenBao Connection Issues
1. Verify EHR Keys Management System is running
2. Check if `ehr-keys-management-system_ehr-keys-net` network exists: `docker network ls | grep ehr-keys`
3. Verify OpenBao is accessible: `curl http://openbao:8200/v1/sys/health` (from within Docker network) or `curl http://localhost:18200/v1/sys/health` (local)
4. Check container logs: `docker-compose -f docker-compose.dev.yml logs ehr-server-dev`
5. **Note**: The server implements automatic fallback - it will try localhost (18200) first, then Docker network (8200) if localhost fails

### Environment Variable Issues
1. Ensure `.env` file exists in project root
2. Verify variables are not overridden in Docker Compose
3. Check server logs for environment loading messages

#### Configuration Mismatch Between start-dev.sh and docker-compose.dev.yml
**Symptoms**: `start-dev.sh` reports ".env file not found" but `.env` exists, or server container fails to start with environment errors.

**Cause**: Historically, `docker-compose.dev.yml` used `.env.dev` while `start-dev.sh` checked for `.env`.

**Solution**: Update `docker-compose.dev.yml` to use `.env` instead of `.env.dev`:
```yaml
# In docker-compose.dev.yml, change:
env_file:
  - .env  # Was previously .env.dev
```

**Current Status**: This issue has been fixed. Both files now use `.env` for consistency.

### Network Issues
1. Ensure containers are connected to correct networks
2. Verify network configuration in Docker Compose files
3. Check if ports are available and not in use

### Test Execution Issues
1. **Tests timeout in Docker:**
   - Ensure `.env.test` file exists with test configuration
   - Tests use mocked OpenBao, no external network needed
   - Increase timeout in `jest.config.js` if needed

2. **MongoDB connection issues in tests:**
   - Test containers use separate `ehr-test` network
   - Verify MongoDB test container is healthy
   - Check test runner logs: `docker-compose -f docker-compose.test.yml logs test-runner`

3. **Coverage reports not generated:**
   - Ensure `/app/coverage` directory is mounted in Docker
   - Check permissions on host `coverage/` directory

## Security Notes

1. **Never commit `.env` files** to version control
2. Use different secrets for different environments
3. Generate strong JWT secrets: `openssl rand -base64 32`
4. In production, use AppRole authentication instead of static tokens
5. Enable TLS for OpenBao communication in production
