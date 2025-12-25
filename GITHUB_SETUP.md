# GitHub Repository Setup

This document explains how to configure GitHub Actions variables and secrets for RetreatFlow360.

## Required Secrets (Already Configured ✅)

These should already be set up in your GitHub repository:

- `CLOUDFLARE_API_TOKEN` - Your Cloudflare API token
- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID

## Required Variables (Need to Configure)

You need to set the following repository variables for the frontend apps to build correctly:

### Option 1: Using GitHub CLI (Recommended)

If you have the [GitHub CLI](https://cli.github.com/) installed:

```bash
# Run the setup script
./scripts/setup-github-vars.sh
```

### Option 2: Manual Setup via GitHub UI

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click on the **Variables** tab
4. Add the following variables:

#### STAGING_API_URL
- **Name:** `STAGING_API_URL`
- **Value:** `https://retreatflow360-api-staging.samuel-1e5.workers.dev`

#### PRODUCTION_API_URL
- **Name:** `PRODUCTION_API_URL`
- **Value:** `https://retreatflow360-api.samuel-1e5.workers.dev`

## Worker Secrets (Need to Configure)

Worker secrets are stored in Cloudflare and are accessed by your Workers at runtime.

### Setup via Script (Recommended)

```bash
./scripts/setup-secrets.sh
```

This interactive script will guide you through setting up all required secrets for both staging and production environments.

### Required Secrets

You'll need to provide:

1. **JWT_SECRET** - Secret key for JWT token signing (min 32 characters)
   - Generate with: `openssl rand -base64 32`

2. **STRIPE_SECRET_KEY** - Stripe secret key (starts with `sk_`)
   - Get from: https://dashboard.stripe.com/apikeys

3. **STRIPE_WEBHOOK_SECRET** - Stripe webhook secret (starts with `whsec_`)
   - Get from: https://dashboard.stripe.com/webhooks

4. **RESEND_API_KEY** - Resend API key for email delivery (starts with `re_`)
   - Get from: https://resend.com/api-keys

5. **TURNSTILE_SECRET_KEY** - Cloudflare Turnstile secret key
   - Get from: https://dash.cloudflare.com/turnstile

### Optional Secrets

6. **MICROSOFT_CLIENT_SECRET** - Microsoft OAuth client secret (optional)
   - Only needed if using Microsoft authentication
   - Get from: https://portal.azure.com/

7. **PAYPAL_CLIENT_SECRET** - PayPal client secret (optional)
   - Only needed if accepting PayPal payments
   - Get from: https://developer.paypal.com/

8. **GOCARDLESS_ACCESS_TOKEN** - GoCardless access token (optional)
   - Only needed if accepting direct debit payments (UK/EU)
   - Get from: https://manage.gocardless.com/

## Verification

After setting up the variables and secrets:

1. **Verify GitHub Variables:**
   ```bash
   # Using GitHub CLI
   gh variable list

   # Or check in GitHub UI: Settings → Secrets and variables → Actions → Variables
   ```

2. **Verify Worker Secrets:**
   ```bash
   # List secrets for staging
   cd apps/api
   npx wrangler secret list --env staging

   # List secrets for production
   npx wrangler secret list --env production
   ```

## Next Steps

Once all variables and secrets are configured:

1. **Test Staging Deployment** - Push to `develop` branch (if you have one) or manually deploy
2. **Deploy to Production** - Push to `main` branch to trigger production deployment
3. **Monitor Deployments** - Check GitHub Actions tab for deployment status

## Troubleshooting

### GitHub Actions Fails with "STAGING_API_URL is not set"

This means the GitHub variables haven't been configured yet. Follow the steps above to set `STAGING_API_URL` and `PRODUCTION_API_URL`.

### Worker Deployment Fails with Authentication Errors

This usually means secrets are missing. Run:

```bash
./scripts/setup-secrets.sh
```

And ensure all required secrets are set for your target environment.

### "Required Worker name missing" Error

This means you're running wrangler commands from the wrong directory. Wrangler commands should be run from the worker's directory (e.g., `apps/api`).

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Cloudflare Workers Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [GitHub CLI](https://cli.github.com/)
