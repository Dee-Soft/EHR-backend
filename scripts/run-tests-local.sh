#!/bin/bash
# Script to run tests locally (without Docker)

set -e

echo "========================================="
echo "EHR Backend Local Test Runner"
echo "========================================="

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "⚠ node_modules not found. Installing dependencies..."
    npm ci
fi

# Parse command line arguments
TEST_TYPE="all"
COVERAGE=false
WATCH=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --unit)
            TEST_TYPE="unit"
            shift
            ;;
        --integration)
            TEST_TYPE="integration"
            shift
            ;;
        --security)
            TEST_TYPE="security"
            shift
            ;;
        --coverage)
            COVERAGE=true
            shift
            ;;
        --watch)
            WATCH=true
            shift
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  --unit        Run unit tests only"
            echo "  --integration Run integration tests only"
            echo "  --security    Run security tests only"
            echo "  --coverage    Run with coverage reporting"
            echo "  --watch       Run in watch mode"
            echo "  --help        Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

echo "Test type: $TEST_TYPE"
echo "Coverage: $COVERAGE"
echo "Watch mode: $WATCH"
echo ""

# Set up test command
TEST_CMD="npm run test"

case $TEST_TYPE in
    "unit")
        TEST_CMD="npm run test:unit"
        ;;
    "integration")
        TEST_CMD="npm run test:integration"
        ;;
    "security")
        TEST_CMD="npm run test:security"
        ;;
esac

if [ "$COVERAGE" = true ]; then
    TEST_CMD="npm run test:coverage"
fi

if [ "$WATCH" = true ]; then
    TEST_CMD="npm run test:watch"
fi

echo "Running: $TEST_CMD"
echo "========================================="

# Run the test command
eval $TEST_CMD

TEST_EXIT_CODE=$?

echo ""
echo "========================================="
echo "Test execution completed"
echo "========================================="

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "✅ All tests passed!"
    
    if [ "$COVERAGE" = true ] || [ "$TEST_CMD" = "npm run test:coverage" ]; then
        if [ -d "coverage" ]; then
            echo ""
            echo "Coverage report generated in:"
            echo "  - HTML: coverage/lcov-report/index.html"
            echo "  - LCOV: coverage/lcov.info"
        fi
    fi
else
    echo "❌ Tests failed with exit code: $TEST_EXIT_CODE"
fi

echo ""
echo "========================================="

exit $TEST_EXIT_CODE
