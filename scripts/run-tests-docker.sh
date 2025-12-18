#!/bin/bash
# Script to run tests in Docker containers

set -e

echo "========================================="
echo "EHR Backend Docker Test Runner"
echo "========================================="

# Check if env.test exists
if [ ! -f .env.test ]; then
    echo "❌ Error: env.test file not found!"
    echo "Please ensure env.test exists with test configuration"
    exit 1
fi

echo "✓ .env.test file found"

# Clean up any existing test containers with volumes
echo "Cleaning up existing test containers and volumes..."
docker-compose -f docker-compose.test.yml down -v --remove-orphans 2>/dev/null || true

# Also clean up any dangling containers
echo "Removing any dangling containers..."
docker ps -a -q --filter "name=ehr-" | xargs docker rm -f 2>/dev/null || true

echo ""
echo "Building and starting test environment..."
echo "This may take a few minutes on first run..."
echo ""

# Build and run tests with orphan removal
docker-compose -f docker-compose.test.yml up --build --abort-on-container-exit --remove-orphans

# Capture exit code
TEST_EXIT_CODE=$?

echo ""
echo "========================================="
echo "Test execution completed"
echo "========================================="

# Check test results
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "✅ All tests passed!"
    
    # Check if coverage report was generated
    if [ -d "coverage" ]; then
        echo ""
        echo "Coverage report generated in:"
        echo "  - HTML: coverage/lcov-report/index.html"
        echo "  - LCOV: coverage/lcov.info"
        
        # Show summary if available
        if [ -f "coverage/coverage-summary.json" ]; then
            echo ""
            echo "Coverage Summary:"
            cat coverage/coverage-summary.json | grep -A 5 '"total"' || true
        fi
    fi
else
    echo "❌ Tests failed with exit code: $TEST_EXIT_CODE"
    echo ""
    echo "Check the test logs above for details."
    echo "You can also run tests locally with: npm run test:integration"
fi

echo ""
echo "Test containers have been stopped."
echo "To view test logs again: docker-compose -f docker-compose.test.yml logs"
echo "To clean up: docker-compose -f docker-compose.test.yml down"
echo "========================================="

exit $TEST_EXIT_CODE