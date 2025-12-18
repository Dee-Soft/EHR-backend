#!/bin/bash
# Script to check and create Docker network if needed

set -e

NETWORK_NAME="ehr-keys-management-system_ehr-keys-net"
ALTERNATIVE_NETWORK_NAME="ehr-keys-net"

echo "Checking Docker network connectivity..."

# Check if network exists
if docker network inspect "$NETWORK_NAME" > /dev/null 2>&1; then
    echo "✓ Network '$NETWORK_NAME' exists and is accessible"
    exit 0
fi

echo "Network '$NETWORK_NAME' not found, checking for alternative name..."

# Check alternative name
if docker network inspect "$ALTERNATIVE_NETWORK_NAME" > /dev/null 2>&1; then
    echo "✓ Network '$ALTERNATIVE_NETWORK_NAME' exists"
    echo "Note: Update docker-compose.dev.yml to use name: $ALTERNATIVE_NETWORK_NAME"
    exit 0
fi

echo "⚠ Neither network '$NETWORK_NAME' nor '$ALTERNATIVE_NETWORK_NAME' found"
echo ""
echo "Possible solutions:"
echo "1. Ensure the EHR Keys Management System is running:"
echo "   docker-compose -f ../ehr-keys-management-system/docker-compose.yml up -d"
echo ""
echo "2. Create a local network for development:"
echo "   docker network create $ALTERNATIVE_NETWORK_NAME"
echo ""
echo "3. Update docker-compose.dev.yml to use internal network only (no OpenBao):"
echo "   - Remove ehr-keys-net from ehr-server networks"
echo "   - Set OPENBAO_ADDR=http://localhost:18200 in .env file"
echo ""
exit 1
