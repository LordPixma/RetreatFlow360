# RetreatFlow360 Setup Guide

This document provides step-by-step instructions for setting up the RetreatFlow360 platform.

## ✅ Completed Setup

The following has been configured and is ready to use:

### 1. Dependencies ✓
- All npm packages installed and verified
- Workspace references configured for npm (not pnpm)
- TypeScript compilation successful across all 16 packages

### 2. Type Checking ✓
- All packages pass TypeScript strict type checking
- Fixed TypeScript configuration for UI package
- Added vite-env.d.ts for web-attendee
- Removed unused imports

### 3. CI/CD Pipelines ✓
- **CI Workflow** ([`.github/workflows/ci.yml`](.github/workflows/ci.yml))
  - Lint & Type Check
  - Unit Tests
  - Build verification
  - E2E Tests with Playwright
  - Runs on push to `main` and `develop` branches

- **Staging Deployment** ([`.github/workflows/deploy-staging.yml`](.github/workflows/deploy-staging.yml))
  - Deploys API worker
  - Deploys all 4 workers (queue-processor, realtime, ai-gateway, cron-scheduler)
  - Deploys all 3 frontend apps (attendee, owner, admin)
  - Runs on push to `develop` branch

- **Production Deployment** ([`.github/workflows/deploy-production.yml`](.github/workflows/deploy-production.yml))
  - Full test suite before deployment
  - API deployment with health checks
  - All workers deployed in parallel
  - All frontend apps deployed to Cloudflare Pages
  - Runs on push to `main` branch

### 4. E2E Test Scaffolding ✓
- Playwright installed and configured
- Test structure created in `/e2e` directory
- Test suites for:
  - Home page navigation
  - Events browsing and search
  - Authentication (login/register)
  - Booking flow
  - Profile management
- Authentication setup for authenticated tests
- CI integration with artifact uploads

### 5. Environment Configuration ✓
- Comprehensive `.env.example` with all required variables
- Development environment file (`.env.development`)
- Per-app environment examples:
  - `apps/web-attendee/.env.example`
  - `apps/web-owner/.env.example`
  - `apps/web-admin/.env.example`
- E2E test environment (e2e/.env.example)
- Updated `.gitignore` to protect sensitive files

## 🚀 Next Steps

### 1. Configure Cloudflare

```bash
# Login to Cloudflare
npx wrangler login

# Create D1 databases
npx wrangler d1 create retreatflow360-db-staging
npx wrangler d1 create retreatflow360-db-production

# Note the database IDs and update wrangler.toml files
```

### 2. Set Environment Variables

#### Local Development
```bash
# Copy and configure root env file
cp .env.example .env
# Edit .env with your credentials

# Copy and configure frontend env files
cp apps/web-attendee/.env.example apps/web-attendee/.env.local
cp apps/web-owner/.env.example apps/web-owner/.env.local
cp apps/web-admin/.env.example apps/web-admin/.env.local

# Configure E2E tests
cp e2e/.env.example e2e/.env
```

#### GitHub Secrets
Add these secrets to your GitHub repository (Settings > Secrets and variables > Actions):
- `CLOUDFLARE_API_TOKEN` - Get from Cloudflare dashboard
- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID

#### GitHub Variables
Add these variables to your GitHub repository:
- `STAGING_API_URL` - Your staging API URL
- `PRODUCTION_API_URL` - Your production API URL

### 3. Run Database Migrations

```bash
cd packages/database

# For local development
npm run db:migrate

# For staging (requires wrangler.toml configured)
npm run db:migrate:staging

# For production (requires wrangler.toml configured)
npm run db:migrate:production
```

### 4. Start Development Servers

```bash
# From root directory, start all services
npm run dev

# Or start individual services
npm run dev --workspace=@retreatflow360/api          # API on :8787
npm run dev --workspace=@retreatflow360/web-attendee # Attendee on :5173
npm run dev --workspace=@retreatflow360/web-owner    # Owner on :5174
npm run dev --workspace=@retreatflow360/web-admin    # Admin on :5175
```

### 5. Run Tests

```bash
# Type checking
npm run type-check

# Unit tests (when implemented)
npm test

# E2E tests
cd e2e
npm ci
npx playwright install
npm test

# E2E tests with UI
npm run test:ui
```

### 6. Deploy to Staging

```bash
# Create and push to develop branch
git checkout -b develop
git push origin develop
```

This will trigger the staging deployment pipeline.

### 7. Deploy to Production

```bash
# Merge to main and push
git checkout main
git merge develop
git push origin main
```

This will trigger the production deployment pipeline.

## 📋 Required Services

Before deploying, ensure you have accounts and API keys for:

### Required
- ✅ **Cloudflare** - Workers, D1, R2, KV (free tier available)
- ✅ **Resend** - Email delivery (free tier: 3,000 emails/month)
- ✅ **Stripe** - Payment processing (test mode is free)

### Optional
- **PayPal** - Alternative payment method
- **GoCardless** - Direct debit payments
- **Microsoft Azure** - OAuth SSO
- **Twilio** - SMS notifications
- **Sentry** - Error monitoring

## 🔍 Verification Checklist

- [ ] All dependencies installed (`npm install`)
- [ ] Type checking passes (`npm run type-check`)
- [ ] Environment files configured
- [ ] Cloudflare account set up
- [ ] D1 databases created
- [ ] GitHub secrets configured
- [ ] Database migrations run
- [ ] Development servers start successfully
- [ ] E2E tests pass locally
- [ ] CI pipeline runs successfully
- [ ] Staging deployment works
- [ ] Production deployment works

## 📚 Additional Documentation

- [README.md](./README.md) - Project overview and quick start
- [DESIGN.md](./DESIGN.md) - High-level architecture and design decisions
- [API Documentation](http://localhost:8787/api/v1/docs) - OpenAPI/Swagger docs (when API is running)

## 🆘 Troubleshooting

### TypeScript Errors
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run type-check
```

### Build Failures
```bash
# Clean build artifacts
npx turbo clean
npm run build
```

### E2E Test Failures
```bash
# Ensure dev servers are running
npm run dev

# In another terminal
cd e2e
npx playwright test --debug
```

### Deployment Failures
- Check GitHub Actions logs
- Verify all secrets are set
- Ensure wrangler.toml is configured correctly
- Check Cloudflare dashboard for error logs

## 📞 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review GitHub Actions logs for CI/CD issues
3. Check Cloudflare Workers logs for runtime issues
4. Review the [DESIGN.md](./DESIGN.md) for architecture questions
