#!/bin/bash
# Simple test to verify Docker test infrastructure works

set -e

echo "========================================="
echo "Simple Docker Test Verification"
echo "========================================="

# Clean up any existing containers
echo "Cleaning up..."
docker-compose -f docker-compose.test.yml down 2>/dev/null || true

echo ""
echo "Starting MongoDB test container..."
docker-compose -f docker-compose.test.yml up -d mongodb-test

echo "Waiting for MongoDB to be healthy..."
sleep 10

echo ""
echo "Checking MongoDB connection..."
if docker-compose -f docker-compose.test.yml exec -T mongodb-test mongosh --eval "db.adminCommand('ping')" | grep -q "ok.*1"; then
    echo "✅ MongoDB is healthy"
else
    echo "❌ MongoDB health check failed"
    docker-compose -f docker-compose.test.yml logs mongodb-test
    exit 1
fi

echo ""
echo "Running a simple Node.js test in Docker..."
cat > /tmp/simple-test.js << 'EOF'
console.log("Simple test running...");
console.log("Node version:", process.version);
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("MONGO_URI:", process.env.MONGO_URI ? "Set" : "Not set");
console.log("Test completed successfully!");
EOF

docker run --rm --network ehr-backend_ehr-test \
  -e NODE_ENV=test \
  -e MONGO_URI=mongodb://mongodb-test:27017/ehr-test \
  -v /tmp/simple-test.js:/app/test.js \
  node:24-alpine node /app/test.js

if [ $? -eq 0 ]; then
    echo "✅ Simple Docker test passed"
else
    echo "❌ Simple Docker test failed"
fi

echo ""
echo "Cleaning up..."
docker-compose -f docker-compose.test.yml down

echo ""
echo "========================================="
echo "Test infrastructure verification complete"
echo "========================================="
