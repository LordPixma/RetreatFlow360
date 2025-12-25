#!/bin/bash
# Setup initial data for RetreatFlow360
# Creates a global admin user and a demo tenant

set -e

API_URL="${1:-https://retreatflow360-api.samuel-1e5.workers.dev}"

echo "========================================="
echo "RetreatFlow360 - Initial Data Setup"
echo "========================================="
echo "API URL: $API_URL"
echo ""

# Create Global Admin User
echo "Creating global admin user..."
ADMIN_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@retreatflow360.com",
    "password": "AdminPass123",
    "firstName": "Global",
    "lastName": "Admin"
  }')

if echo "$ADMIN_RESPONSE" | jq -e '.success' > /dev/null; then
  ADMIN_ID=$(echo "$ADMIN_RESPONSE" | jq -r '.data.user.id')
  ADMIN_TOKEN=$(echo "$ADMIN_RESPONSE" | jq -r '.data.accessToken')
  echo "✅ Global admin created: admin@retreatflow360.com"
  echo "   User ID: $ADMIN_ID"
else
  ERROR=$(echo "$ADMIN_RESPONSE" | jq -r '.error.message')
  echo "❌ Failed to create admin: $ERROR"

  # Try to login instead
  echo "Attempting to login..."
  LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d '{
      "email": "admin@retreatflow360.com",
      "password": "AdminPass123"
    }')

  if echo "$LOGIN_RESPONSE" | jq -e '.success' > /dev/null; then
    ADMIN_ID=$(echo "$LOGIN_RESPONSE" | jq -r '.data.user.id')
    ADMIN_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.accessToken')
    echo "✅ Logged in as existing admin"
  else
    echo "❌ Could not create or login as admin"
    exit 1
  fi
fi

echo ""
echo "Admin Access Token (expires in 15 min):"
echo "$ADMIN_TOKEN"
echo ""

# Manually update admin role to 'global_admin' (requires database access)
echo "========================================="
echo "MANUAL STEP REQUIRED"
echo "========================================="
echo ""
echo "To make this user a global admin, run this command:"
echo ""
echo "npx wrangler d1 execute retreatflow360-prod --remote \\"
echo "  --command=\"UPDATE users SET role='global_admin' WHERE id='$ADMIN_ID'\""
echo ""
echo "Or for staging:"
echo "npx wrangler d1 execute retreatflow360-staging --remote \\"
echo "  --command=\"UPDATE users SET role='global_admin' WHERE id='$ADMIN_ID'\""
echo ""
echo "After updating the role, you can create tenants via the admin API."
echo ""

# Save credentials to file
cat > .admin-credentials << EOF
# RetreatFlow360 Admin Credentials
# DO NOT COMMIT THIS FILE

Admin Email: admin@retreatflow360.com
Admin Password: AdminPass123
Admin User ID: $ADMIN_ID

# To upgrade to global admin:
npx wrangler d1 execute retreatflow360-prod --remote --command="UPDATE users SET role='global_admin' WHERE id='$ADMIN_ID'"

# Access Token (expires in 15 min):
$ADMIN_TOKEN
EOF

echo "Credentials saved to .admin-credentials"
echo ""
echo "Next steps:"
echo "1. Run the database command above to upgrade the user to global admin"
echo "2. Use the admin token to create tenants via /api/v1/admin/tenants"
echo "3. Create venues and events within tenant context"
echo ""
