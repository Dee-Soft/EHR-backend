# Electronic Health Record (EHR) Backend System

A secure, HIPAA-compliant Electronic Health Record backend system implementing role-based access control with end-to-end encryption. Built with Node.js, Express, MongoDB, and OpenBao Transit Engine for cryptographic operations.

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Security Overview](#security-overview)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Docker Deployment](#docker-deployment)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [Testing](#testing)
- [Project Structure](#project-structure)
- [License](#license)

## Features

- **Role-Based Access Control (RBAC)**: Five distinct user roles with granular permissions (Admin, Manager, Provider, Employee, Patient)
- **End-to-End Encryption**: All sensitive data encrypted using OpenBao Transit Engine
- **Secure Authentication**: JWT-based authentication with HTTP-only cookies and SameSite protection
- **Comprehensive Audit Logging**: Detailed audit trails for all sensitive operations
- **Health Monitoring**: Kubernetes-ready health check endpoints with readiness and liveness probes
- **Structured Logging**: Winston logger with daily rotation and 30-day retention
- **Centralized Error Handling**: Consistent error responses with detailed logging
- **Rate Limiting Protection**: Defense against brute-force attacks with configurable limits
- **Containerization Support**: Complete Docker and Docker Compose configurations for development, testing, and production

## Architecture

The system follows a three-tier architecture with separate key management:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │────▶│  EHR Server │────▶│   MongoDB   │
│  (React)    │     │  (Express)  │     │  (Database) │
└─────────────┘     └──────┬──────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────────────┐
                    │ OpenBao Keys        │
                    │ Management System   │
                    │ (Transit + Postgres)│
                    └─────────────────────┘
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
5. **Utilities**: Helper functions and shared utilities

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
git clone https://github.com/yourorg/ehr-backend.git
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

For development with hot reload:

```bash
docker compose -f docker-compose.dev.yml up --build
```

### Testing Environment

For isolated testing with mocked services:

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
| `NODE_ENV` | Application environment | `production` |
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
| `OPENBAO_TRANSIT_AES_KEY` | AES key name in OpenBao | `ehr-aes-master` |
| `OPENBAO_TRANSIT_RSA_KEY` | RSA key name in OpenBao | `ehr-rsa-exchange` |

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

- `POST /users/register` - Register new user (role-based permissions apply)
- `PUT /users/:id` - Update user information (role-based permissions apply)

### Patient Records

- `POST /patient-records` - Create new patient record (Provider/Manager roles)
- `GET /patient-records` - Retrieve all patient records (Manager role only)
- `GET /patient-records/my-records` - Retrieve patient's own records (Patient role)
- `GET /patient-records/:id` - Retrieve specific patient record (role-based access)

### Administrative Functions

- `GET /admin/audit-logs` - View system audit logs (Admin role only)
- `GET /admin/audit-logs/export` - Export audit logs as CSV (Admin role only)
- `POST /admin/assign-patient` - Assign patient to healthcare provider (Admin role only)

### Health Monitoring

- `GET /health` - Comprehensive health status
- `GET /health/ready` - Readiness probe for Kubernetes
- `GET /health/live` - Liveness probe for Kubernetes

### Key Exchange

- `GET /key-exchange/public-key` - Retrieve RSA public key for secure communication

For detailed API documentation including request/response schemas and examples, generate documentation locally:

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

### Test Structure

```
test/
├── unit/                  # Unit tests
├── integration/           # Integration tests
├── security/              # Security tests
└── setup/
    ├── mocks/            # Mock implementations
    ├── fixtures/         # Test data
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
│   └── openbao.config.js # OpenBao client configuration
├── controllers/        # Request handlers
├── middlewares/        # Custom middleware functions
├── models/            # Mongoose schemas and models
├── routes/            # API route definitions
├── services/          # Business logic services
├── utils/             # Utility functions
├── test/              # Test suites
├── logs/              # Application logs
├── scripts/           # Utility scripts
├── docker-compose.yml # Docker Compose configuration
├── Dockerfile         # Production Dockerfile
└── server.js          # Application entry point
```

## License

This project is licensed under the ISC License.