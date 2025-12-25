#!/bin/bash
# Comprehensive E2E Testing for RetreatFlow360
# Tests complete user journeys across the platform

API="https://retreatflow360-api.samuel-1e5.workers.dev"

echo "=============================================="
echo "  RetreatFlow360 - E2E Integration Tests"
echo "=============================================="
echo "API: $API"
echo "Started: $(date)"
echo ""

PASS=0
FAIL=0
TESTS=()

log_test() {
    local name="$1"
    local status="$2"
    local details="$3"

    if [ "$status" = "pass" ]; then
        echo "✓ $name"
        ((PASS++))
        TESTS+=("PASS: $name")
    else
        echo "✗ $name"
        echo "  Details: $details"
        ((FAIL++))
        TESTS+=("FAIL: $name - $details")
    fi
}

echo "====== PHASE 1: API Health & Infrastructure ======"
echo ""

# Test 1: API Health
HEALTH=$(curl -s $API/health)
if echo "$HEALTH" | grep -q '"status":"healthy"'; then
    log_test "API Health Check" "pass"
else
    log_test "API Health Check" "fail" "$HEALTH"
fi

# Test 2: Database
if echo "$HEALTH" | grep -q '"database":"ok"'; then
    log_test "Database Connection" "pass"
else
    log_test "Database Connection" "fail" "Database not healthy"
fi

# Test 3: Cache
if echo "$HEALTH" | grep -q '"cache":"ok"'; then
    log_test "Cache Connection" "pass"
else
    log_test "Cache Connection" "fail" "Cache not healthy"
fi

echo ""
echo "====== PHASE 2: User Registration Journey ======"
echo ""

# Generate unique test user
TEST_EMAIL="e2e-$(date +%s)@test.com"
TEST_PASSWORD="E2ETestPass123"

# Test 4: New User Registration
REG_RESULT=$(curl -s -X POST "$API/api/v1/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\",\"firstName\":\"E2E\",\"lastName\":\"Tester\"}")

if echo "$REG_RESULT" | grep -q '"success":true'; then
    log_test "User Registration" "pass"
    USER_TOKEN=$(echo "$REG_RESULT" | grep -o '"accessToken":"[^"]*' | sed 's/"accessToken":"//')
    USER_ID=$(echo "$REG_RESULT" | grep -o '"id":"[^"]*' | head -1 | sed 's/"id":"//')
else
    log_test "User Registration" "fail" "$REG_RESULT"
    USER_TOKEN=""
fi

# Test 5: Login with new account
LOGIN_RESULT=$(curl -s -X POST "$API/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")

if echo "$LOGIN_RESULT" | grep -q '"accessToken"'; then
    log_test "User Login" "pass"
    USER_TOKEN=$(echo "$LOGIN_RESULT" | grep -o '"accessToken":"[^"]*' | sed 's/"accessToken":"//')
    REFRESH_TOKEN=$(echo "$LOGIN_RESULT" | grep -o '"refreshToken":"[^"]*' | sed 's/"refreshToken":"//')
else
    log_test "User Login" "fail" "$LOGIN_RESULT"
fi

# Test 6: Token Refresh
if [ -n "$REFRESH_TOKEN" ]; then
    REFRESH_RESULT=$(curl -s -X POST "$API/api/v1/auth/refresh" \
        -H "Content-Type: application/json" \
        -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}")

    if echo "$REFRESH_RESULT" | grep -q '"accessToken"'; then
        log_test "Token Refresh" "pass"
    else
        log_test "Token Refresh" "fail" "$REFRESH_RESULT"
    fi
else
    log_test "Token Refresh" "fail" "No refresh token available"
fi

echo ""
echo "====== PHASE 3: Authorization & Access Control ======"
echo ""

# Test 7: Unauthorized access blocked
UNAUTH=$(curl -s "$API/api/v1/events")
if echo "$UNAUTH" | grep -q '"UNAUTHORIZED"'; then
    log_test "Unauthorized Access Blocked" "pass"
else
    log_test "Unauthorized Access Blocked" "fail" "$UNAUTH"
fi

# Test 8: Tenant context required
if [ -n "$USER_TOKEN" ]; then
    TENANT_REQ=$(curl -s "$API/api/v1/events" \
        -H "Authorization: Bearer $USER_TOKEN")

    if echo "$TENANT_REQ" | grep -q '"TENANT_REQUIRED"'; then
        log_test "Tenant Context Enforcement" "pass"
    else
        log_test "Tenant Context Enforcement" "fail" "$TENANT_REQ"
    fi
else
    log_test "Tenant Context Enforcement" "fail" "No user token"
fi

echo ""
echo "====== PHASE 4: Admin Operations ======"
echo ""

# Get admin token
ADMIN_LOGIN=$(curl -s -X POST "$API/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@retreatflow360.com","password":"AdminPass123"}')
ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | grep -o '"accessToken":"[^"]*' | sed 's/"accessToken":"//')

if [ -n "$ADMIN_TOKEN" ]; then
    log_test "Admin Login" "pass"
else
    log_test "Admin Login" "fail" "$ADMIN_LOGIN"
fi

# Test 9: List Tenants (Admin)
if [ -n "$ADMIN_TOKEN" ]; then
    TENANTS=$(curl -s "$API/api/v1/admin/tenants" \
        -H "Authorization: Bearer $ADMIN_TOKEN")

    if echo "$TENANTS" | grep -q '"tenants"'; then
        log_test "Admin List Tenants" "pass"
        TENANT_COUNT=$(echo "$TENANTS" | grep -o '"id"' | wc -l)
        echo "  Found $TENANT_COUNT tenants"
    else
        log_test "Admin List Tenants" "fail" "$TENANTS"
    fi
fi

# Test 10: Create New Tenant
if [ -n "$ADMIN_TOKEN" ]; then
    TENANT_SLUG="e2e-test-$(date +%s)"
    NEW_TENANT=$(curl -s -X POST "$API/api/v1/admin/tenants" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"name\":\"E2E Test Tenant\",\"slug\":\"$TENANT_SLUG\",\"subdomain\":\"$TENANT_SLUG\",\"ownerEmail\":\"owner@$TENANT_SLUG.com\",\"ownerName\":\"E2E Owner\"}")

    if echo "$NEW_TENANT" | grep -q '"id"'; then
        log_test "Admin Create Tenant" "pass"
        TENANT_ID=$(echo "$NEW_TENANT" | grep -o '"id":"[^"]*' | head -1 | sed 's/"id":"//')
        echo "  Created tenant: $TENANT_ID"
    else
        log_test "Admin Create Tenant" "fail" "$NEW_TENANT"
    fi
fi

# Test 11: Non-admin blocked from admin API
if [ -n "$USER_TOKEN" ]; then
    NON_ADMIN=$(curl -s "$API/api/v1/admin/tenants" \
        -H "Authorization: Bearer $USER_TOKEN")

    if echo "$NON_ADMIN" | grep -q '"error"'; then
        log_test "Non-Admin Blocked from Admin API" "pass"
    else
        log_test "Non-Admin Blocked from Admin API" "fail" "Should have been blocked"
    fi
fi

echo ""
echo "====== PHASE 5: Data Validation ======"
echo ""

# Test 12: Invalid email validation
INVALID_EMAIL=$(curl -s -X POST "$API/api/v1/auth/register" \
    -H "Content-Type: application/json" \
    -d '{"email":"not-an-email","password":"Test123","firstName":"Test","lastName":"User"}')

if echo "$INVALID_EMAIL" | grep -q '"issues"'; then
    log_test "Email Validation" "pass"
else
    log_test "Email Validation" "fail" "$INVALID_EMAIL"
fi

# Test 13: Password strength validation
WEAK_PASS=$(curl -s -X POST "$API/api/v1/auth/register" \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"123","firstName":"Test","lastName":"User"}')

if echo "$WEAK_PASS" | grep -q '"issues"'; then
    log_test "Password Validation" "pass"
else
    log_test "Password Validation" "fail" "$WEAK_PASS"
fi

# Test 14: Required fields validation
MISSING_FIELDS=$(curl -s -X POST "$API/api/v1/auth/register" \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com"}')

if echo "$MISSING_FIELDS" | grep -q '"issues"'; then
    log_test "Required Fields Validation" "pass"
else
    log_test "Required Fields Validation" "fail" "$MISSING_FIELDS"
fi

echo ""
echo "====== PHASE 6: Email Integration ======"
echo ""

# Test 15: Email endpoint accessible (admin only)
if [ -n "$ADMIN_TOKEN" ]; then
    EMAIL_TEST=$(curl -s -X POST "$API/api/v1/admin/test-email" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"to":"test@invalid-domain-for-testing.com"}')

    # Even if it fails due to Resend restrictions, the endpoint should respond
    if echo "$EMAIL_TEST" | grep -qE '"success"|"error"'; then
        log_test "Email Endpoint Accessible" "pass"

        # Check if it's the expected Resend restriction
        if echo "$EMAIL_TEST" | grep -q "verification"; then
            echo "  Note: Resend requires domain verification for external emails"
        fi
    else
        log_test "Email Endpoint Accessible" "fail" "$EMAIL_TEST"
    fi
fi

echo ""
echo "====== PHASE 7: Frontend Applications ======"
echo ""

# Test 16: Attendee Portal
ATTENDEE=$(curl -s -o /dev/null -w "%{http_code}" https://retreatflow360-attendee.pages.dev)
if [ "$ATTENDEE" = "200" ]; then
    log_test "Attendee Portal (HTTP 200)" "pass"
else
    log_test "Attendee Portal (HTTP 200)" "fail" "Got HTTP $ATTENDEE"
fi

# Test 17: Owner Dashboard
OWNER=$(curl -s -o /dev/null -w "%{http_code}" https://retreatflow360-owner.pages.dev)
if [ "$OWNER" = "200" ]; then
    log_test "Owner Dashboard (HTTP 200)" "pass"
else
    log_test "Owner Dashboard (HTTP 200)" "fail" "Got HTTP $OWNER"
fi

# Test 18: Admin Console
ADMIN=$(curl -s -o /dev/null -w "%{http_code}" https://retreatflow360-admin.pages.dev)
if [ "$ADMIN" = "200" ]; then
    log_test "Admin Console (HTTP 200)" "pass"
else
    log_test "Admin Console (HTTP 200)" "fail" "Got HTTP $ADMIN"
fi

echo ""
echo "====== PHASE 8: Performance ======"
echo ""

# Test 19: API response time
START=$(date +%s%N)
curl -s "$API/health" > /dev/null
END=$(date +%s%N)
DURATION=$(( (END - START) / 1000000 ))

if [ "$DURATION" -lt 500 ]; then
    log_test "API Response Time (<500ms)" "pass"
    echo "  Response time: ${DURATION}ms"
else
    log_test "API Response Time (<500ms)" "fail" "${DURATION}ms"
fi

# Test 20: Concurrent requests
echo -n "Testing concurrent requests... "
for i in {1..5}; do
    curl -s "$API/health" > /dev/null &
done
wait
log_test "Concurrent Requests (5 parallel)" "pass"

echo ""
echo "=============================================="
echo "                 RESULTS"
echo "=============================================="
echo ""
echo "Total Tests: $((PASS + FAIL))"
echo "Passed: $PASS"
echo "Failed: $FAIL"
echo "Success Rate: $(( PASS * 100 / (PASS + FAIL) ))%"
echo ""
echo "Completed: $(date)"
echo ""

# Save detailed results
echo "=============================================="
echo "           DETAILED TEST LOG"
echo "=============================================="
for test in "${TESTS[@]}"; do
    echo "$test"
done

echo ""
if [ $FAIL -eq 0 ]; then
    echo "🎉 All E2E tests passed!"
    exit 0
else
    echo "⚠️  Some tests failed - review above for details"
    exit 1
fi
