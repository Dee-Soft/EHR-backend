#!/bin/bash
# Development startup script with network validation

set -e

echo "========================================="
echo "EHR Backend Development Startup"
echo "========================================="

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "Please copy env.example to .env and update the values"
    echo "  cp env.example .env"
    exit 1
fi

echo "✓ .env file found"

# Clean up any existing development containers with volumes
echo "Cleaning up existing development containers and volumes..."
docker-compose -f docker-compose.dev.yml down -v --remove-orphans 2>/dev/null || true

# Also clean up any dangling containers
echo "Removing any dangling containers..."
docker ps -a -q --filter "name=ehr-" | xargs docker rm -f 2>/dev/null || true

# Check Docker network connectivity
echo "Checking Docker network..."
if ! ./scripts/check-network.sh; then
    echo ""
    echo "⚠ Network check failed. Attempting to start anyway..."
    echo "If Docker Compose fails, try the solutions above."
    echo ""
    read -p "Press Enter to continue or Ctrl+C to cancel..."
fi

echo ""
echo "Starting Docker Compose development environment..."
echo "Using: docker-compose -f docker-compose.dev.yml up --remove-orphans"
echo ""
echo "Services will be available at:"
echo "  - EHR API: http://localhost:3001"
echo "  - MongoDB: localhost:27017"
echo "  - OpenBao: http://openbao:8200 (via Docker network)"
echo ""
echo "Press Ctrl+C to stop all services"
echo "========================================="

# Start Docker Compose with orphan removal
docker-compose -f docker-compose.dev.yml up --remove-orphans
