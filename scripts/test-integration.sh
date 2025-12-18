#!/bin/bash

# Integration Test Runner
# Runs integration tests locally or in Docker

set -e

echo "==========================================="
echo "EHR Backend Integration Test Runner"
echo "==========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored messages
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Parse command line arguments
MODE="local"
TEST_TYPE="all"

while [[ $# -gt 0 ]]; do
    case $1 in
        --docker)
            MODE="docker"
            shift
            ;;
        --local)
            MODE="local"
            shift
            ;;
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
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --docker       Run tests in Docker containers"
            echo "  --local        Run tests locally (default)"
            echo "  --unit         Run unit tests only"
            echo "  --integration  Run integration tests only"
            echo "  --security     Run security tests only"
            echo "  --help         Show this help message"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

print_info "Mode: $MODE"
print_info "Test type: $TEST_TYPE"

run_local_tests() {
    print_step "Running tests locally..."
    
    case $TEST_TYPE in
        "unit")
            print_info "Running unit tests..."
            npm run test:unit
            ;;
        "integration")
            print_info "Running integration tests..."
            npm run test:integration
            ;;
        "security")
            print_info "Running security tests..."
            npm run test:security
            ;;
        "all")
            print_info "Running all tests with coverage..."
            npm run test:coverage
            ;;
    esac
}

run_docker_tests() {
    print_step "Running tests in Docker..."
    
    # Check if Docker is running
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    
    # Set environment variable for test type
    export TEST_TYPE=$TEST_TYPE
    
    # Clean up any existing test containers
    print_info "Cleaning up existing test containers..."
    docker-compose -f docker-compose.test.yml down -v 2>/dev/null || true
    
    # Build and run tests
    print_info "Building and starting test containers..."
    
    if [ "$TEST_TYPE" = "all" ]; then
        # Run all tests with coverage
        if docker-compose -f docker-compose.test.yml up --build --abort-on-container-exit; then
            print_info "All tests passed!"
        else
            print_error "Tests failed!"
            exit 1
        fi
    else
        # Run specific test type
        print_info "Running $TEST_TYPE tests in Docker..."
        docker-compose -f docker-compose.test.yml run --rm test-runner npm run test:$TEST_TYPE
    fi
    
    # Clean up
    print_info "Cleaning up test containers..."
    docker-compose -f docker-compose.test.yml down -v
}

# Main execution
if [ "$MODE" = "docker" ]; then
    run_docker_tests
else
    run_local_tests
fi

echo "==========================================="
print_info "Test execution completed successfully! ✅"
echo "==========================================="
