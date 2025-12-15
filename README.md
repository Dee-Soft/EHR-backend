# EHR Backend System

> A secure, HIPAA-compliant Electronic Health Record (EHR) backend system built with Node.js, Express, MongoDB, and OpenBao Transit Engine for cryptographic operations.

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Security](#security)
- [Getting Started](#getting-started)
- [Docker Deployment](#docker-deployment)
- [Environment Variables](#environment-variables)
- [API Documentation](#api-documentation)
- [Testing](#testing)
- [Logging](#logging)
- [Health Checks](#health-checks)
- [Development](#development)
- [Contributing](#contributing)

## Features

- **Role-Based Access Control (RBAC)**: Five distinct roles (Admin, Manager, Provider, Employee, Patient)
- **End-to-End Encryption**: OpenBao Transit Engine for all cryptographic operations
- **Secure Authentication**: JWT-based authentication with httpOnly cookies
- **Audit Logging**: Comprehensive audit trails for all sensitive operations
- **Health Monitoring**: Kubernetes-ready health check endpoints
- **Structured Logging**: Winston logger with daily rotation
- **Error Handling**: Centralized error handling with detailed logging
- **Rate Limiting**: Protection against brute-force attacks
- **Docker Ready**: Complete Docker and Docker Compose configuration

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │────▶│  EHR Server │────▶│   MongoDB   │
│  (React)    │     │  (Express)  │     │  (Database) │
└─────────────┘     └──────┬──────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   OpenBao   │
                    │  (Transit)  │
                    └─────────────┘
```

### Key Components

1. **Controllers**: Handle HTTP requests and business logic
2. **Services**: Encapsulate business logic and external service interactions
3. **Middlewares**: Handle authentication, encryption, decryption, and validation
4. **Models**: MongoDB schemas with Mongoose
5. **Utils**: Helper functions and utilities

## Technology Stack

- **Runtime**: Node.js 24.x
- **Framework**: Express.js 4.x
- **Database**: MongoDB 7.x
- **Encryption**: OpenBao Transit Engine
- **Authentication**: JWT (jsonwebtoken)
- **Logging**: Winston with daily rotation
- **Testing**: Jest with Supertest
- **Containerization**: Docker & Docker Compose

## Security

### Encryption Strategy

- **OpenBao Transit Engine**: All cryptographic operations
- **AES-256-GCM**: Data encryption at rest
- **RSA-2048**: Key exchange with frontend
- **Key Versioning**: Automatic key rotation support
- **Envelope Encryption**: Data keys encrypted with master key

### Authentication & Authorization

- **JWT Tokens**: Secure, stateless authentication
- **HttpOnly Cookies**: XSS protection
- **SameSite Strict**: CSRF protection
- **Role-Based Access**: Granular permissions per role
- **Audit Logging**: All authentication attempts logged

### Security Headers

- **Helmet**: Security headers (CSP, HSTS, etc.)
- **CORS**: Configured for trusted origins
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Auth Rate Limiting**: 5 login attempts per 15 minutes

## Getting Started

### Prerequisites

- Node.js 24.x or higher
- MongoDB 7.x
- OpenBao (or HashiCorp Vault)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourorg/ehr-backend.git
   cd ehr-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start OpenBao** (if running locally)
   ```bash
   # In dev mode
   openbao server -dev -dev-root-token-id="your-token"
   ```

5. **Initialize OpenBao Transit Engine**
   ```bash
   chmod +x scripts/init-openbao.sh
   ./scripts/init-openbao.sh
   ```

6. **Seed Admin User**
   ```bash
   npm run seed:admin
   ```

7. **Start the server**
   ```bash
   npm run dev
   ```

The server will start on `http://localhost:3001`

## Docker Deployment

### Using Docker Compose

1. **Start all services**
   ```bash
   docker-compose up -d
   ```

   This starts:
   - EHR Backend Server (port 3001)
   - MongoDB (port 27017)
   - OpenBao (port 8200)

2. **View logs**
   ```bash
   docker-compose logs -f ehr-server
   ```

3. **Stop services**
   ```bash
   docker-compose down
   ```

### Production Deployment

```bash
# Build production image
docker build -t ehr-backend:latest .

# Run with environment file
docker-compose --env-file .env.production up -d
```

### Run Tests in Docker

```bash
docker-compose -f docker-compose.test.yml up --abort-on-container-exit
```

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `production` |
| `PORT` | Server port | `3001` |
| `MONGO_URI` | MongoDB connection string | `mongodb://localhost:27017/ehr` |
| `OPENBAO_ADDR` | OpenBao address | `http://localhost:8200` |
| `OPENBAO_TOKEN` | OpenBao token | `s.xxxxx` |
| `JWT_SECRET` | JWT signing secret | `your-secret-key` |
| `FRONTEND_URL` | Frontend URL for CORS | `http://localhost:3000` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `LOG_LEVEL` | Logging level | `info` |
| `OPENBAO_TRANSIT_AES_KEY` | AES key name | `ehr-aes-master` |
| `OPENBAO_TRANSIT_RSA_KEY` | RSA key name | `ehr-rsa-exchange` |

See `.env.example` for complete configuration.

## API Documentation

### Base URL

```
http://localhost:3001/api
```

### Authentication Endpoints

- `POST /auth/login` - User login
- `POST /auth/logout` - User logout
- `GET /auth/me` - Get current user

### User Management

- `POST /users/register` - Register new user (RBAC)
- `PUT /users/:id` - Update user (RBAC)

### Patient Records

- `POST /patient-records` - Create record (Provider/Manager)
- `GET /patient-records` - Get all records (Manager only)
- `GET /patient-records/my-records` - Get own records (Patient)
- `GET /patient-records/:id` - Get specific record (RBAC)

### Admin Endpoints

- `GET /admin/audit-logs` - View audit logs (Admin only)
- `GET /admin/audit-logs/export` - Export CSV (Admin only)
- `POST /admin/assign-patient` - Assign patient to provider (Admin only)

### Health Checks

- `GET /health` - Overall health status
- `GET /health/ready` - Readiness probe (K8s)
- `GET /health/live` - Liveness probe (K8s)

### Key Exchange

- `GET /key-exchange/public-key` - Get RSA public key

For detailed API documentation, see [API.md](docs/API.md) or run:
```bash
npm run docs
```

## Testing

### Run All Tests

```bash
npm test
```

### Test Coverage

```bash
npm run test:coverage
```

### Test Types

```bash
npm run test:unit          # Unit tests
npm run test:integration   # Integration tests
npm run test:security      # Security tests
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
    └── testDb.js         # Test database setup
```

### Coverage Goals

- **Overall**: 80%+ coverage
- **Critical Paths**: 100% (auth, encryption, RBAC)

## Logging

### Winston Logger

Structured logging with daily rotation:

```javascript
const logger = require('./config/logger');

logger.info('User logged in', { userId: user.id });
logger.error('Operation failed', { error: err.message });
logger.warn('Rate limit exceeded', { ip: req.ip });
```

### Log Levels

- `error`: Error conditions
- `warn`: Warning conditions
- `info`: Informational messages
- `http`: HTTP requests (Morgan)
- `debug`: Debug messages

### Log Files

```
logs/
├── error-YYYY-MM-DD.log    # Error logs
└── combined-YYYY-MM-DD.log # All logs
```

Logs are retained for 30 days with automatic rotation.

## Health Checks

### Kubernetes Probes

**Liveness Probe**
```yaml
livenessProbe:
  httpGet:
    path: /api/health/live
    port: 3001
  initialDelaySeconds: 40
  periodSeconds: 30
```

**Readiness Probe**
```yaml
readinessProbe:
  httpGet:
    path: /api/health/ready
    port: 3001
  initialDelaySeconds: 10
  periodSeconds: 10
```

### Health Check Response

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "services": {
    "api": {
      "status": "operational",
      "uptime": 3600,
      "memory": {...}
    },
    "mongodb": {
      "status": "connected",
      "readyState": 1
    },
    "openbao": {
      "healthy": true,
      "initialized": true,
      "sealed": false
    }
  }
}
```

## Development

### Code Style

- **Linter**: ESLint
- **Formatter**: Prettier (if configured)
- **Commits**: Conventional Commits (Commitizen)

### Git Hooks

- **pre-commit**: Runs linter (optional)
- **commit-msg**: Validates commit message format

### Commit Messages

```bash
npm run commit
```

Follows Conventional Commits specification:
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `test:` Test additions/changes
- `refactor:` Code refactoring

### Development Workflow

1. Create feature branch
2. Make changes with tests
3. Run tests locally
4. Commit using Commitizen
5. Push and create PR
6. CI/CD runs tests
7. Review and merge

## RBAC Matrix

| Role | Register Users | Create Records | View All Records | View Own Records | Admin Access |
|------|----------------|----------------|------------------|------------------|--------------|
| Admin | All | ✓ | ✓ | - | ✓ |
| Manager | Employee, Provider, Patient | ✓ | ✓ | - | - |
| Employee | Patient | - | - | - | - |
| Provider | - | Assigned Patients | Assigned Patients | - | - |
| Patient | - | - | - | ✓ | - |

## Project Structure

```
ehr-backend/
├── config/              # Configuration files
│   ├── db.js           # MongoDB connection
│   ├── logger.js       # Winston configuration
│   └── openbao.config.js
├── controllers/        # Request handlers
├── middlewares/        # Custom middleware
├── models/            # Mongoose schemas
├── routes/            # API routes
├── services/          # Business logic
├── utils/             # Helper functions
├── test/              # Test suites
├── logs/              # Log files
├── scripts/           # Utility scripts
├── docker-compose.yml # Docker Compose config
├── Dockerfile         # Production Dockerfile
└── server.js          # Entry point
```

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`npm run commit`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Guidelines

- Follow existing code style
- Write tests for new features
- Update documentation
- Ensure all tests pass
- Follow conventional commits

## License

ISC License - See LICENSE file for details

## Support

For issues and questions:
- GitHub Issues: [Report Bug](https://github.com/yourorg/ehr-backend/issues)
- Email: support@ehr-system.com

## Acknowledgments

- OpenBao Team for secure key management
- Express.js Community
- MongoDB Team
- All contributors

---

**Built with ❤️ for secure healthcare data management**

