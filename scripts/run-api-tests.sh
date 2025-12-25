#!/bin/bash
# Comprehensive API testing for RetreatFlow360
# Tests all major functionality end-to-end

set -e

API_URL="${1:-https://retreatflow360-api.samuel-1e5.workers.dev}"
RESULTS_FILE="test-results.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Test results array
declare -a TEST_RESULTS

echo "========================================="
echo "RetreatFlow360 - Comprehensive API Tests"
echo "========================================="
echo "API URL: $API_URL"
echo "Started: $(date)"
echo ""

# Helper function to run a test
run_test() {
    local test_name="$1"
    local description="$2"
    local command="$3"
    local expected_pattern="$4"

    ((TOTAL_TESTS++))
    echo -n "[$TOTAL_TESTS] Testing: $test_name... "

    # Run the command and capture output
    local output=$(eval "$command" 2>&1)
    local exit_code=$?

    # Check if output matches expected pattern
    if echo "$output" | grep -q "$expected_pattern"; then
        echo -e "${GREEN}✓ PASS${NC}"
        ((PASSED_TESTS++))
        TEST_RESULTS+=("{\"test\":\"$test_name\",\"status\":\"pass\",\"description\":\"$description\"}")
    else
        echo -e "${RED}✗ FAIL${NC}"
        echo "  Expected: $expected_pattern"
        echo "  Got: $output"
        ((FAILED_TESTS++))
        TEST_RESULTS+=("{\"test\":\"$test_name\",\"status\":\"fail\",\"description\":\"$description\",\"error\":\"Pattern not found\"}")
    fi
}

echo "=== 1. HEALTH & CONNECTIVITY TESTS ==="
echo ""

run_test "API Health Check" \
    "API should return healthy status" \
    "curl -s $API_URL/health" \
    '"status":"healthy"'

run_test "API Response Time" \
    "API should respond within 500ms" \
    "curl -s -w '%{time_total}' -o /dev/null $API_URL/health" \
    "^0\.[0-5]"

run_test "CORS Headers" \
    "API should include CORS headers" \
    "curl -s -I $API_URL/health" \
    "access-control"

echo ""
echo "=== 2. AUTHENTICATION TESTS ==="
echo ""

# Register a new test user
TEST_EMAIL="test-$(date +%s)@example.com"
TEST_PASSWORD="TestPass123"

run_test "User Registration" \
    "Should create new user account" \
    "curl -s -X POST $API_URL/api/v1/auth/register -H 'Content-Type: application/json' -d '{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\",\"firstName\":\"Test\",\"lastName\":\"User\"}'" \
    '"success":true'

run_test "Duplicate Registration Prevention" \
    "Should reject duplicate email" \
    "curl -s -X POST $API_URL/api/v1/auth/register -H 'Content-Type: application/json' -d '{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\",\"firstName\":\"Test\",\"lastName\":\"User\"}'" \
    '"EMAIL_EXISTS"'

run_test "User Login" \
    "Should authenticate valid credentials" \
    "curl -s -X POST $API_URL/api/v1/auth/login -H 'Content-Type: application/json' -d '{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}'" \
    '"accessToken"'

# Get access token for subsequent tests
LOGIN_RESPONSE=$(curl -s -X POST $API_URL/api/v1/auth/login \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")
ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
REFRESH_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"refreshToken":"[^"]*' | cut -d'"' -f4)

run_test "Invalid Login" \
    "Should reject invalid password" \
    "curl -s -X POST $API_URL/api/v1/auth/login -H 'Content-Type: application/json' -d '{\"email\":\"$TEST_EMAIL\",\"password\":\"WrongPassword\"}'" \
    '"INVALID_CREDENTIALS"'

run_test "Token Refresh" \
    "Should refresh access token" \
    "curl -s -X POST $API_URL/api/v1/auth/refresh -H 'Content-Type: application/json' -d '{\"refreshToken\":\"$REFRESH_TOKEN\"}'" \
    '"accessToken"'

echo ""
echo "=== 3. AUTHORIZATION TESTS ==="
echo ""

run_test "Protected Endpoint Without Token" \
    "Should reject requests without auth" \
    "curl -s $API_URL/api/v1/events" \
    '"UNAUTHORIZED"'

run_test "Protected Endpoint With Token" \
    "Should require tenant context" \
    "curl -s $API_URL/api/v1/events -H 'Authorization: Bearer $ACCESS_TOKEN'" \
    '"TENANT_REQUIRED"'

run_test "Invalid Token" \
    "Should reject invalid tokens" \
    "curl -s $API_URL/api/v1/events -H 'Authorization: Bearer invalid_token_here'" \
    '"UNAUTHORIZED"'

echo ""
echo "=== 4. ADMIN API TESTS ==="
echo ""

# Login as admin
ADMIN_LOGIN=$(curl -s -X POST $API_URL/api/v1/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"email":"admin@retreatflow360.com","password":"AdminPass123"}')
ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

run_test "Admin Tenant List" \
    "Admin should list all tenants" \
    "curl -s $API_URL/api/v1/admin/tenants -H 'Authorization: Bearer $ADMIN_TOKEN'" \
    '"tenants"'

run_test "Admin Create Tenant" \
    "Admin should create new tenant" \
    "curl -s -X POST $API_URL/api/v1/admin/tenants -H 'Authorization: Bearer $ADMIN_TOKEN' -H 'Content-Type: application/json' -d '{\"name\":\"Test Tenant $(date +%s)\",\"slug\":\"test-$(date +%s)\",\"subdomain\":\"test$(date +%s)\",\"ownerEmail\":\"owner@test.com\",\"ownerName\":\"Test Owner\"}'" \
    '"id"'

run_test "Non-Admin Tenant Access" \
    "Regular user should not access admin API" \
    "curl -s $API_URL/api/v1/admin/tenants -H 'Authorization: Bearer $ACCESS_TOKEN'" \
    '"FORBIDDEN"'

echo ""
echo "=== 5. DATABASE TESTS ==="
echo ""

# Query database directly
run_test "Database User Count" \
    "Should count users in database" \
    "npx wrangler d1 execute retreatflow360-prod --remote --command='SELECT COUNT(*) as count FROM users' 2>/dev/null" \
    '"count"'

run_test "Database Tenant Count" \
    "Should count tenants in database" \
    "npx wrangler d1 execute retreatflow360-prod --remote --command='SELECT COUNT(*) as count FROM tenants' 2>/dev/null" \
    '"count"'

run_test "Database Schema" \
    "All tables should exist" \
    "npx wrangler d1 execute retreatflow360-prod --remote --command='SELECT COUNT(*) as table_count FROM sqlite_master WHERE type=\"table\"' 2>/dev/null" \
    '"table_count"'

echo ""
echo "=== 6. VALIDATION TESTS ==="
echo ""

run_test "Email Validation" \
    "Should reject invalid email format" \
    "curl -s -X POST $API_URL/api/v1/auth/register -H 'Content-Type: application/json' -d '{\"email\":\"not-an-email\",\"password\":\"$TEST_PASSWORD\",\"firstName\":\"Test\",\"lastName\":\"User\"}'" \
    '"issues"'

run_test "Password Requirements" \
    "Should enforce password requirements" \
    "curl -s -X POST $API_URL/api/v1/auth/register -H 'Content-Type: application/json' -d '{\"email\":\"test2@example.com\",\"password\":\"123\",\"firstName\":\"Test\",\"lastName\":\"User\"}'" \
    '"issues"'

run_test "Required Fields" \
    "Should require all mandatory fields" \
    "curl -s -X POST $API_URL/api/v1/auth/register -H 'Content-Type: application/json' -d '{\"email\":\"test3@example.com\"}'" \
    '"issues"'

echo ""
echo "=== 7. PERFORMANCE TESTS ==="
echo ""

run_test "Concurrent Requests" \
    "Should handle multiple simultaneous requests" \
    "for i in {1..5}; do curl -s $API_URL/health & done; wait" \
    '"healthy"'

echo ""
echo "========================================="
echo "TEST SUMMARY"
echo "========================================="
echo "Total Tests: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"
echo "Success Rate: $(( PASSED_TESTS * 100 / TOTAL_TESTS ))%"
echo "Completed: $(date)"
echo ""

# Save results to JSON
cat > "$RESULTS_FILE" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "api_url": "$API_URL",
  "total_tests": $TOTAL_TESTS,
  "passed": $PASSED_TESTS,
  "failed": $FAILED_TESTS,
  "success_rate": $(( PASSED_TESTS * 100 / TOTAL_TESTS )),
  "results": [
    $(IFS=,; echo "${TEST_RESULTS[*]}")
  ]
}
EOF

echo "Results saved to: $RESULTS_FILE"
echo ""

# Exit with error if any tests failed
if [ $FAILED_TESTS -gt 0 ]; then
    exit 1
fi

exit 0
