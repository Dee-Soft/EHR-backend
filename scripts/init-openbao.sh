#!/bin/sh
# OpenBao Initialization Script
# Enables Transit Engine and creates required encryption keys

set -e

# Wait for OpenBao to be ready
echo "Waiting for OpenBao to be ready..."
until wget --spider -q http://localhost:8200/v1/sys/health 2>/dev/null; do
  echo "OpenBao is unavailable - sleeping"
  sleep 2
done

echo "OpenBao is up - initializing..."

# Set OpenBao address and token
export VAULT_ADDR='http://localhost:8200'
export VAULT_TOKEN="${OPENBAO_TOKEN:-s.JfR6axjtdGedQeblSsppTMds}"

# Enable Transit Engine
echo "Enabling Transit engine..."
vault secrets enable transit || echo "Transit engine already enabled"

# Create AES Master Key for data encryption
echo "Creating AES master key..."
vault write -f transit/keys/ehr-aes-master \
  type=aes256-gcm96 \
  derived=false \
  exportable=false \
  allow_plaintext_backup=false || echo "AES key already exists"

# Create RSA Key for key exchange
echo "Creating RSA exchange key..."
vault write -f transit/keys/ehr-rsa-exchange \
  type=rsa-2048 \
  derived=false \
  exportable=false \
  allow_plaintext_backup=false || echo "RSA key already exists"

# Set key rotation policy (optional)
echo "Setting key rotation policy..."
vault write transit/keys/ehr-aes-master/config \
  min_decryption_version=1 \
  min_encryption_version=0 \
  deletion_allowed=false \
  auto_rotate_period=30d || echo "Key policy already configured"

vault write transit/keys/ehr-rsa-exchange/config \
  min_decryption_version=1 \
  min_encryption_version=0 \
  deletion_allowed=false || echo "Key policy already configured"

echo "OpenBao initialization complete!"
echo "Keys created:"
echo "  - ehr-aes-master (AES-256-GCM)"
echo "  - ehr-rsa-exchange (RSA-2048)"

