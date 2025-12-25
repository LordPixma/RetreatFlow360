#!/bin/bash
# Setup script for Cloudflare Worker secrets
# Run this after creating your Cloudflare resources

set -e

echo "========================================="
echo "RetreatFlow360 - Cloudflare Secrets Setup"
echo "========================================="
echo ""

# Check if wrangler is installed
if ! command -v npx &> /dev/null; then
    echo "Error: npx not found. Please install Node.js first."
    exit 1
fi

echo "This script will help you set up secrets for your Cloudflare Workers."
echo "You'll need to have the following ready:"
echo "  - JWT secret (min 32 characters)"
echo "  - Stripe API keys"
echo "  - Resend API key"
echo "  - Turnstile secret key"
echo ""
read -p "Press Enter to continue or Ctrl+C to cancel..."

# Function to set secret
set_secret() {
    local env=$1
    local secret_name=$2
    local description=$3

    echo ""
    echo "Setting $secret_name for $env environment"
    echo "Description: $description"
    npx wrangler secret put "$secret_name" --env "$env"
}

# Ask which environment to configure
echo ""
echo "Which environment do you want to configure?"
echo "1) Staging"
echo "2) Production"
echo "3) Both"
read -p "Enter choice [1-3]: " env_choice

case $env_choice in
    1)
        ENVS=("staging")
        ;;
    2)
        ENVS=("production")
        ;;
    3)
        ENVS=("staging" "production")
        ;;
    *)
        echo "Invalid choice. Exiting."
        exit 1
        ;;
esac

# Set secrets for each environment
for ENV in "${ENVS[@]}"; do
    echo ""
    echo "========================================="
    echo "Configuring $ENV environment"
    echo "========================================="

    # JWT Secret
    set_secret "$ENV" "JWT_SECRET" "Secret key for JWT token signing (min 32 chars)"

    # Stripe
    set_secret "$ENV" "STRIPE_SECRET_KEY" "Stripe secret key (sk_...)"
    set_secret "$ENV" "STRIPE_WEBHOOK_SECRET" "Stripe webhook secret (whsec_...)"

    # Resend
    set_secret "$ENV" "RESEND_API_KEY" "Resend API key for email delivery (re_...)"

    # Turnstile
    set_secret "$ENV" "TURNSTILE_SECRET_KEY" "Cloudflare Turnstile secret key"

    # Optional: Microsoft OAuth
    read -p "Do you want to configure Microsoft OAuth for $ENV? (y/n): " setup_oauth
    if [[ "$setup_oauth" == "y" ]]; then
        set_secret "$ENV" "MICROSOFT_CLIENT_SECRET" "Microsoft OAuth client secret"
    fi

    # Optional: PayPal
    read -p "Do you want to configure PayPal for $ENV? (y/n): " setup_paypal
    if [[ "$setup_paypal" == "y" ]]; then
        set_secret "$ENV" "PAYPAL_CLIENT_SECRET" "PayPal client secret"
    fi

    # Optional: GoCardless
    read -p "Do you want to configure GoCardless for $ENV? (y/n): " setup_gocardless
    if [[ "$setup_gocardless" == "y" ]]; then
        set_secret "$ENV" "GOCARDLESS_ACCESS_TOKEN" "GoCardless access token"
    fi
done

echo ""
echo "========================================="
echo "Secrets setup complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Run database migrations: cd packages/database && npm run db:migrate"
echo "2. Deploy workers: git push origin develop (for staging) or main (for production)"
echo "3. Configure Cloudflare Pages projects in the dashboard"
echo ""
