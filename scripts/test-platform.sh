#!/bin/bash
# Simple but comprehensive platform tests

API_URL="https://retreatflow360-api.samuel-1e5.workers.dev"

echo "========================================="
echo "RetreatFlow360 - Platform Tests"
echo "========================================="
echo ""

PASS=0
FAIL=0

test_endpoint() {
    local name="$1"
    local cmd="$2"
    local check="$3"

    echo -n "Testing $name... "
    result=$(eval "$cmd")

    if echo "$result" | grep -q "$check"; then
        echo "✓ PASS"
        ((PASS++))
    else
        echo "✗ FAIL"
        echo "  Output: $result"
        ((FAIL++))
    fi
}

echo "=== API Health ==="
test_endpoint "Health Check" \
    "curl -s $API_URL/health" \
    '"status":"healthy"'

test_endpoint "Database Connection" \
    "curl -s $API_URL/health" \
    '"database":"ok"'

test_endpoint "Cache Connection" \
    "curl -s $API_URL/health" \
    '"cache":"ok"'

echo ""
echo "=== Authentication ==="

# Create unique test user
EMAIL="test-$(date +%s)@example.com"
PASS_WORD="TestPass123"

test_endpoint "User Registration" \
    "curl -s -X POST $API_URL/api/v1/auth/register -H 'Content-Type: application/json' -d '{\"email\":\"$EMAIL\",\"password\":\"$PASS_WORD\",\"firstName\":\"Test\",\"lastName\":\"User\"}'" \
    '"success":true'

test_endpoint "Duplicate Email Rejection" \
    "curl -s -X POST $API_URL/api/v1/auth/register -H 'Content-Type: application/json' -d '{\"email\":\"$EMAIL\",\"password\":\"$PASS_WORD\",\"firstName\":\"Test\",\"lastName\":\"User\"}'" \
    '"EMAIL_EXISTS"'

test_endpoint "User Login" \
    "curl -s -X POST $API_URL/api/v1/auth/login -H 'Content-Type: application/json' -d '{\"email\":\"$EMAIL\",\"password\":\"$PASS_WORD\"}'" \
    '"accessToken"'

test_endpoint "Invalid Login Rejection" \
    "curl -s -X POST $API_URL/api/v1/auth/login -H 'Content-Type: application/json' -d '{\"email\":\"$EMAIL\",\"password\":\"WrongPassword\"}'" \
    '"INVALID_CREDENTIALS"'

echo ""
echo "=== Authorization ==="

# Get token
TOKEN=$(curl -s -X POST $API_URL/api/v1/auth/login -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS_WORD\"}" | grep -o '"accessToken":"[^"]*' | sed 's/"accessToken":"//')

test_endpoint "Unauthorized Access Blocked" \
    "curl -s $API_URL/api/v1/events" \
    '"UNAUTHORIZED"'

test_endpoint "Tenant Context Required" \
    "curl -s $API_URL/api/v1/events -H 'Authorization: Bearer $TOKEN'" \
    '"TENANT_REQUIRED"'

echo ""
echo "=== Admin API ==="

# Get admin token
ADMIN_TOKEN=$(curl -s -X POST $API_URL/api/v1/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@retreatflow360.com","password":"AdminPass123"}' | grep -o '"accessToken":"[^"]*' | sed 's/"accessToken":"//')

test_endpoint "Admin Tenant List" \
    "curl -s $API_URL/api/v1/admin/tenants -H 'Authorization: Bearer $ADMIN_TOKEN'" \
    '"tenants"'

test_endpoint "Non-Admin Blocked" \
    "curl -s $API_URL/api/v1/admin/tenants -H 'Authorization: Bearer $TOKEN'" \
    '"FORBIDDEN"'

echo ""
echo "=== Validation ==="

test_endpoint "Email Format Validation" \
    "curl -s -X POST $API_URL/api/v1/auth/register -H 'Content-Type: application/json' -d '{\"email\":\"not-an-email\",\"password\":\"Pass123\",\"firstName\":\"Test\",\"lastName\":\"User\"}'" \
    '"issues"'

test_endpoint "Password Strength" \
    "curl -s -X POST $API_URL/api/v1/auth/register -H 'Content-Type: application/json' -d '{\"email\":\"test@test.com\",\"password\":\"123\",\"firstName\":\"Test\",\"lastName\":\"User\"}'" \
    '"issues"'

echo ""
echo "=== Frontend Apps ==="

test_endpoint "Attendee Portal" \
    "curl -s -o /dev/null -w '%{http_code}' https://retreatflow360-attendee.pages.dev" \
    "200"

test_endpoint "Owner Dashboard" \
    "curl -s -o /dev/null -w '%{http_code}' https://retreatflow360-owner.pages.dev" \
    "200"

test_endpoint "Admin Console" \
    "curl -s -o /dev/null -w '%{http_code}' https://retreatflow360-admin.pages.dev" \
    "200"

echo ""
echo "========================================="
echo "RESULTS"
echo "========================================="
echo "Passed: $PASS"
echo "Failed: $FAIL"
echo "Total: $((PASS + FAIL))"
echo "Success Rate: $(( PASS * 100 / (PASS + FAIL) ))%"
echo ""

if [ $FAIL -eq 0 ]; then
    echo "✓ All tests passed!"
    exit 0
else
    echo "✗ Some tests failed"
    exit 1
fi
