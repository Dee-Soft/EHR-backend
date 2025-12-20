#!/bin/bash
# Cleanup script for test files created during manual testing

echo "Cleaning up test files..."

# Remove created test files
rm -f /tmp/test_data.json
rm -f /tmp/provider_cookie.txt
rm -f /tmp/patient_cookie.txt
rm -f /tmp/cookies.txt

# Remove created script files
rm -f createTestUsers.js

echo "Test files cleaned up."
echo ""
echo "Note: Test users remain in the database. To remove them:"
echo "1. Connect to MongoDB"
echo "2. Delete users with test emails:"
echo "   - manager@test.com"
echo "   - provider@test.com" 
echo "   - patient@test.com"
echo "   - assigned.patient@test.com"
echo ""
echo "Test records created during testing also remain in the database."
