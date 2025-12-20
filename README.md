# Electronic Health Record (EHR) Backend System

A secure, HIPAA-compliant Electronic Health Record backend system implementing role-based access control with end-to-end encryption. Built with Node.js, Express, MongoDB, and OpenBao Transit Engine for cryptographic operations.

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Docker Deployment](#docker-deployment)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [Testing](#testing)
- [Project Structure](#project-structure)
- [License](#license)
- [About](#about)

## Features

- **Role-Based Access Control (RBAC)**: Five distinct user roles with granular permissions (Admin, Manager, Provider, Employee, Patient)
- **End-to-End Encryption**: All sensitive data encrypted using OpenBao Transit Engine
- **Secure Authentication**: JWT-based authentication with HTTP-only cookies and SameSite protection
- **Comprehensive Audit Logging**: Detailed audit trails for all sensitive operations
- **Health Monitoring**: Kubernetes-ready health check endpoints with readiness and liveness probes
- **Structured Logging**: Winston logger with daily rotation and 30-day retention
- **Centralized Error Handling**: Consistent error responses with detailed logging
- **Rate Limiting Protection**: Defense against brute-force attacks
- **Containerization Support**: Docker and Docker Compose configurations
- **Role-Specific APIs**: Separate endpoints for different user roles
- **Patient Record Management**: Secure creation and retrieval of medical records

## Architecture

The system follows a three-tier architecture with separate key management:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │────▶│  EHR Server │────▶│   MongoDB   │
│  (React)    │     │  (Express)  │     │  (Database) │
└─────────────┘     └─────────────┘     └─────────────┘
```

### Key Management System

The EHR backend utilizes a standalone OpenBao Keys Management System that operates independently with PostgreSQL storage. This architecture provides:

- **Centralized Key Management**: Cryptographic keys managed separately from application data
- **Persistent Storage**: PostgreSQL-based key storage with audit logging capabilities
- **Network Isolation**: Independent Docker network for enhanced security
- **Dual Endpoint Support**: 
  - `http://localhost:18200` for local development environments
  - `http://openbao:8200` for Docker network communication

### System Components

1. **Controllers**: HTTP request handlers implementing business logic
2. **Services**: Business logic encapsulation and external service interactions
3. **Middlewares**: Authentication, encryption, decryption, and validation layers
4. **Models**: MongoDB schemas defined using Mongoose ODM
5. **Services**: Business logic and external service interactions
6. **Utilities**: Helper functions and shared utilities
7. **Cron Jobs**: Scheduled tasks for system maintenance

## Technology Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Runtime | Node.js | 24.x |
| Framework | Express.js | 4.x |
| Database | MongoDB | 7.x |
| Encryption | OpenBao Transit Engine | - |
| Authentication | JSON Web Tokens (JWT) | - |
| Logging | Winston with Daily Rotate File | - |
| Testing | Jest with Supertest | - |
| Containerization | Docker & Docker Compose | - |
| ODM | Mongoose | 7.3.1 |
| Security | Helmet.js, bcrypt, rate limiting | - |

## Security Overview

### Encryption Strategy

- **OpenBao Transit Engine**: All cryptographic operations delegated to dedicated key management
- **AES-256-GCM**: Data encryption at rest with authenticated encryption
- **RSA-2048**: Secure key exchange mechanism with frontend applications
- **Key Versioning**: Support for automatic key rotation and version management
- **Envelope Encryption**: Data keys encrypted with master keys for enhanced security

### Authentication & Authorization

- **JWT Tokens**: Stateless authentication with configurable expiration
- **HTTP-Only Cookies**: Cross-site scripting (XSS) protection
- **SameSite Strict**: Cross-site request forgery (CSRF) protection
- **Role-Based Access Control**: Granular permissions based on five distinct roles
- **Audit Logging**: Comprehensive logging of all authentication attempts

### Security Headers

- **Helmet.js**: Security headers including Content Security Policy (CSP) and HTTP Strict Transport Security (HSTS)
- **CORS Configuration**: Restrictive Cross-Origin Resource Sharing for trusted origins only
- **Rate Limiting**: 100 requests per 15 minutes per IP address
- **Authentication Rate Limiting**: 5 login attempts per 15 minutes per IP address

## Prerequisites

- Node.js 24.x or higher
- MongoDB 7.x
- OpenBao Keys Management System (or HashiCorp Vault)
- npm or yarn package manager

## Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/Dee-Soft/EHR-backend.git
cd ehr-backend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

Create a `.env` file in the project root with the required environment variables. Refer to the [Configuration Guide](CONFIGURATION.md) for detailed variable definitions.

### 4. Initialize OpenBao Transit Engine

```bash
chmod +x scripts/init-openbao.sh
./scripts/init-openbao.sh
```

### 5. Seed Administrative User

```bash
npm run seed:admin
```

### 6. Start Development Server

```bash
npm run dev
```

The server will be available at `http://localhost:3001`.

## Docker Deployment

### Development Environment

For development with MongoDB:

```bash
docker compose -f docker-compose.dev.yml up --build
```

### Testing Environment

For isolated testing:

```bash
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit
```

### Production Deployment

For production deployment:

```bash
docker compose --env-file .env.production up -d --build
```

### OpenBao Keys Management System

The EHR backend requires a separate OpenBao Keys Management System. This system operates independently with PostgreSQL storage and provides cryptographic services. For deployment instructions, refer to the [EHR Keys Management System repository](https://github.com/Dee-Soft/ehr-keys-management-system).

**Key Configuration Notes:**
- Default port: 18200
- Development token: `ehr-permanent-token`
- Network configuration required for Docker communication

## Configuration

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Application environment | `development`, `production`, `test` |
| `PORT` | Server port | `3001` |
| `MONGO_URI` | MongoDB connection string | `mongodb://localhost:27017/ehr` |
| `OPENBAO_ADDR` | OpenBao Keys Management System address | `http://localhost:18200` (local) / `http://host.docker.internal:18200` (Docker) |
| `OPENBAO_TOKEN` | OpenBao authentication token | `ehr-permanent-token` (development) |
| `JWT_SECRET` | JWT signing secret | `your-secret-key` |
| `FRONTEND_URL` | Frontend URL for CORS configuration | `http://localhost:3000` |

### Optional Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `LOG_LEVEL` | Logging verbosity level | `info` |
| `OPENBAO_TRANSIT_AES_BACKEND_KEY` | Backend AES key name in OpenBao | `ehr-aes-master-backend` |
| `OPENBAO_TRANSIT_AES_FRONTEND_KEY` | Frontend AES key name in OpenBao | `ehr-aes-master-frontend` |
| `OPENBAO_TRANSIT_RSA_BACKEND_KEY` | Backend RSA key name in OpenBao | `ehr-rsa-exchange-backend` |
| `OPENBAO_TRANSIT_RSA_FRONTEND_KEY` | Frontend RSA key name in OpenBao | `ehr-rsa-exchange-frontend` |

Refer to the [Configuration Guide](CONFIGURATION.md) for complete configuration options and environment variable definitions.

## API Reference

### Base URL

```
http://localhost:3001/api
```

### Authentication Endpoints

- `POST /auth/login` - Authenticate user and establish session
- `POST /auth/logout` - Terminate user session
- `GET /auth/me` - Retrieve current authenticated user information

### User Management

- `GET /users` - Get all users (Admin/Manager roles)
- `POST /users/register` - Register new user (Admin/Manager/Employee roles)
- `PUT /users/:id` - Update user information (role-based permissions)

### Patient Records

- `POST /patient-records` - Create new patient record (authenticated users)
- `GET /patient-records` - Retrieve all patient records (role-based access)
- `GET /patient-records/my-records` - Retrieve patient's own records (Patient role)
- `GET /patient-records/:id` - Retrieve specific patient record (role-based access)
- `GET /patient-records/provider/assigned` - Get assigned patient records (Provider role)

### Employee Routes

- `GET /employees/providers` - Get all available providers
- `GET /employees/patients` - Get all patients
- `GET /employees/assignments` - Get all patient-provider assignments
- `POST /employees/assignments` - Assign patient to provider

### Manager Routes

- `GET /managers/employees` - Get all employees
- `PUT /managers/employees/:id` - Update employee information
- `DELETE /managers/employees/:id` - Delete employee
- `PUT /managers/providers/:id` - Update provider information
- `GET /managers/system-stats` - Get system statistics
- `GET /managers/providers` - Get all providers (inherited from employee routes)
- `GET /managers/patients` - Get all patients (inherited from employee routes)
- `GET /managers/assignments` - Get all assignments (inherited from employee routes)
- `POST /managers/assignments` - Assign patient to provider (inherited from employee routes)

### Provider Routes

- `GET /providers/profile` - Get provider's own profile
- `PUT /providers/availability` - Update provider availability
- `GET /providers/assigned-patients` - Get provider's assigned patients
- `GET /providers/patient-records` - Get patient records for assigned patients

### Admin Routes

- `GET /admin/users` - Get all users (Admin only)
- `GET /admin/users/:id` - Get user by ID (Admin only)
- `DELETE /admin/users/:id` - Delete user by ID (Admin only)
- `GET /admin/audit-logs` - Get all audit logs (Admin only)
- `GET /admin/audit-logs/export` - Export audit logs as CSV (Admin only)
- `GET /admin/audit-logs/export/json` - Export audit logs as JSON (Admin only)

### Health Monitoring

- `GET /health` - Comprehensive health status
- `GET /health/ready` - Readiness probe for Kubernetes
- `GET /health/live` - Liveness probe for Kubernetes

### Key Exchange

- `GET /key-exchange/public-key` - Retrieve backend RSA public key for secure communication
- `GET /key-exchange/frontend-public-key` - Retrieve frontend RSA public key from OpenBao

For detailed API documentation, generate documentation locally:

```bash
npm run docs
```

## Testing

### Test Execution

Run complete test suite:

```bash
npm test
```

### Test Coverage

Generate test coverage report:

```bash
npm run test:coverage
```

### Test Categories

Execute specific test categories:

```bash
npm run test:unit          # Unit tests
npm run test:integration   # Integration tests
npm run test:security      # Security tests
```

### Docker-Based Testing

Execute tests in isolated Docker environment:

```bash
npm run test:docker
```

### Local Testing Scripts

Run tests with local setup:

```bash
npm run test:local          # All tests
npm run test:local:unit     # Unit tests only
npm run test:local:integration  # Integration tests only
npm run test:local:security # Security tests only
npm run test:local:coverage # Coverage report
```

### Test Structure

```
test/
├── unit/                  # Unit tests
│   ├── config/           # Configuration tests
│   ├── middlewares/      # Middleware tests
│   ├── services/         # Service tests
│   └── utils/            # Utility tests
├── integration/          # Integration tests
│   ├── auth.integration.test.js
│   ├── authentication.integration.test.js
│   ├── authorization.integration.test.js
│   ├── health.integration.test.js
│   ├── keyExchange.integration.test.js
│   └── patientRecords.integration.test.js
├── security/             # Security tests
│   ├── encryption.security.test.js
│   └── rbac.security.test.js
└── setup/                # Test setup
    ├── fixtures/         # Test data fixtures
    ├── mocks/            # Mock implementations
    └── testDb.js         # Test database configuration
```

### Coverage Requirements

- **Overall Coverage**: Minimum 80% test coverage
- **Critical Paths**: 100% coverage for authentication, encryption, and RBAC components

## Project Structure

```
ehr-backend/
├── config/              # Configuration files
│   ├── db.js           # MongoDB connection configuration
│   ├── logger.js       # Winston logging configuration
│   ├── openbao.config.js # OpenBao client configuration
│   └── security.js     # Security configuration
├── controllers/        # Request handlers
├── crons/              # Scheduled tasks
├── docs/               # Documentation
├── logs/               # Application logs
├── middlewares/        # Custom middleware functions
├── models/             # Mongoose schemas and models
│   ├── AuditLog.js     # Audit log model
│   ├── PatientRecord.js # Patient record model
│   └── User.js         # User model
├── routes/             # API route definitions
│   ├── adminRoutes.js      # Admin routes
│   ├── authRoutes.js       # Authentication routes
│   ├── employeeRoutes.js   # Employee routes
│   ├── healthRoutes.js     # Health check routes
│   ├── keyExchangeRoutes.js # Key exchange routes
│   ├── managerRoutes.js    # Manager routes
│   ├── patientRecordRoutes.js # Patient record routes
│   ├── providerRoutes.js   # Provider routes
│   └── userRoutes.js       # User routes
├── scripts/            # Utility scripts
├── services/           # Business logic services
├── test/               # Test suites
├── utils/              # Utility functions
├── docker-compose.yml  # Docker Compose configuration
├── Dockerfile          # Production Dockerfile
├── env.example         # Environment variables template
├── package.json        # Dependencies and scripts
├── README.md           # This documentation
└── server.js           # Application entry point
```

## License

This project is licensed under the ISC License.

## About

This EHR Backend System was developed by Sarfaraj Shahjahan as part of a cybersecurity assessment project. The system implements role-based access control with five distinct user roles and provides secure healthcare data management.

### GitHub Repository

- **Repository**: https://github.com/Dee-Soft/EHR-backend
- **Author**: Sarfaraj Shahjahan
- **Version**: 1.0.0

### Key Features Implemented

1. **Five User Roles**: Admin, Manager, Provider, Employee, Patient
2. **Role-Based APIs**: Separate endpoints for different user roles
3. **Secure Authentication**: JWT-based authentication with HTTP-only cookies
4. **Audit Logging**: Comprehensive logging of all sensitive operations
5. **Health Monitoring**: Health endpoints
6. **Docker Support**: Complete containerization with Docker Compose
7. **Comprehensive Testing**: Unit, integration, and security tests

### Development Notes

- The system uses MongoDB as the primary database
- Winston logger with daily rotation for structured logging
- Helmet.js for security headers and protection
- Rate limiting for API and authentication endpoints
- Comprehensive error handling and validation