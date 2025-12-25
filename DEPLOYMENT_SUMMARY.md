# RetreatFlow360 Deployment Summary

**Last Updated:** 2025-12-25

## ✅ Completed Setup

### 1. Infrastructure Created

#### Cloudflare Workers (All Deployed to Staging)
- ✅ **API Worker** - Main application API (Hono framework)
- ✅ **Queue Processor** - Background job processing
- ✅ **Realtime Worker** - WebSocket connections with Durable Objects
- ✅ **AI Gateway** - AI request routing with rate limiting
- ✅ **Cron Scheduler** - Scheduled tasks (hourly)

#### Cloudflare Storage Resources
- ✅ **D1 Databases** - 2 databases (staging + production)
  - 22 tables each
  - All migrations applied
- ✅ **KV Namespaces** - 4 namespaces (sessions + cache for each environment)
- ✅ **R2 Buckets** - 2 buckets (staging + production)
- ✅ **Queues** - 4 queues (notifications + payments for each environment)
- ✅ **Vectorize Indexes** - 2 indexes (staging + production, 768 dimensions)

#### Cloudflare Pages Projects
- ✅ **Attendee Portal** - staging + production
- ✅ **Owner Dashboard** - staging + production
- ✅ **Admin Console** - staging + production

### 2. Staging Environment Status

**URL:** https://retreatflow360-api-staging.samuel-1e5.workers.dev

**Status:** ✅ HEALTHY (tested 2025-12-25)
- Database: OK
- Cache: OK
- Latency: 221ms

### 3. Production Environment Status

**Status:** ⏸️ READY (not deployed yet)
- Database migrated
- All resources created
- Secrets need to be configured

## 📋 Manual Steps Required

### STEP 1: Configure Worker Secrets (REQUIRED)

You need to set up secrets for your workers to function properly.

**Run the interactive setup script:**
```bash
./scripts/setup-secrets.sh
```

The script will prompt you for:
1. JWT_SECRET (generate with: `openssl rand -base64 32`)
2. STRIPE_SECRET_KEY (from Stripe dashboard)
3. STRIPE_WEBHOOK_SECRET (from Stripe webhooks)
4. RESEND_API_KEY (from Resend dashboard)
5. TURNSTILE_SECRET_KEY (from Cloudflare Turnstile)
6. Optional: Microsoft OAuth, PayPal, GoCardless credentials

**Or manually set secrets:**
```bash
cd apps/api

# Set secrets for staging
npx wrangler secret put JWT_SECRET --env staging
npx wrangler secret put STRIPE_SECRET_KEY --env staging
npx wrangler secret put STRIPE_WEBHOOK_SECRET --env staging
npx wrangler secret put RESEND_API_KEY --env staging
npx wrangler secret put TURNSTILE_SECRET_KEY --env staging

# Set secrets for production
npx wrangler secret put JWT_SECRET --env production
npx wrangler secret put STRIPE_SECRET_KEY --env production
npx wrangler secret put STRIPE_WEBHOOK_SECRET --env production
npx wrangler secret put RESEND_API_KEY --env production
npx wrangler secret put TURNSTILE_SECRET_KEY --env production
```

### STEP 2: Configure GitHub Variables (REQUIRED for Frontend Deployment)

These variables are needed for the frontend apps to know which API to connect to.

**Option 1: Using GitHub CLI**
```bash
./scripts/setup-github-vars.sh
```

**Option 2: Manual via GitHub UI**

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Secrets and variables** → **Actions** → **Variables**
3. Add these variables:

| Variable Name | Value |
|--------------|-------|
| `STAGING_API_URL` | `https://retreatflow360-api-staging.samuel-1e5.workers.dev` |
| `PRODUCTION_API_URL` | `https://retreatflow360-api.samuel-1e5.workers.dev` |

See [GITHUB_SETUP.md](GITHUB_SETUP.md) for detailed instructions.

### STEP 3: Deploy Frontend Apps (Optional - Manual First Deploy)

The frontend apps will auto-deploy via GitHub Actions on future commits, but you can do a manual first deploy:

```bash
# Build and deploy attendee portal to staging
cd apps/web-attendee
npm run build
npx wrangler pages deploy dist --project-name=retreatflow360-attendee-staging

# Build and deploy owner dashboard to staging
cd ../web-owner
npm run build
npx wrangler pages deploy dist --project-name=retreatflow360-owner-staging

# Build and deploy admin console to staging
cd ../web-admin
npm run build
npx wrangler pages deploy dist --project-name=retreatflow360-admin-staging
```

## 🚀 Automated Deployments

### GitHub Actions Workflows

#### CI Pipeline (`.github/workflows/ci.yml`)
**Triggers:** Every push to any branch
- Runs type-check across all packages
- Runs unit tests
- Runs E2E tests (Playwright)

#### Staging Deployment (`.github/workflows/deploy-staging.yml`)
**Triggers:** Push to `develop` branch (or `main` for now)
- Deploys API worker
- Deploys all support workers (queue-processor, realtime, ai-gateway, cron-scheduler)
- Deploys frontend apps (attendee, owner, admin)

#### Production Deployment (`.github/workflows/deploy-production.yml`)
**Triggers:** Push to `main` branch
- Runs full test suite first
- Deploys API worker with health check
- Deploys all support workers
- Deploys frontend apps

## 🧪 Testing Staging Environment

Once secrets are configured, test the staging environment:

### 1. API Endpoints

```bash
# Health check (already tested ✅)
curl https://retreatflow360-api-staging.samuel-1e5.workers.dev/health

# Test registration
curl -X POST https://retreatflow360-api-staging.samuel-1e5.workers.dev/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!",
    "firstName": "Test",
    "lastName": "User"
  }'

# Test login
curl -X POST https://retreatflow360-api-staging.samuel-1e5.workers.dev/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!"
  }'
```

### 2. Frontend Apps (After Deployment)

- **Attendee Portal:** https://retreatflow360-attendee-staging.pages.dev
- **Owner Dashboard:** https://retreatflow360-owner-staging.pages.dev
- **Admin Console:** https://retreatflow360-admin-staging.pages.dev

### 3. Monitoring

```bash
# Tail API worker logs
npx wrangler tail retreatflow360-api-staging

# Tail queue processor logs
cd workers/queue-processor
npx wrangler tail retreatflow360-queue-processor-staging

# Query database
npx wrangler d1 execute retreatflow360-staging --remote \
  --command="SELECT COUNT(*) FROM users"
```

## 📊 Production Deployment Checklist

Before deploying to production:

- [ ] All staging tests passing
- [ ] Production secrets configured (run `./scripts/setup-secrets.sh`)
- [ ] GitHub variables configured (PRODUCTION_API_URL)
- [ ] Payment providers configured (Stripe in live mode)
- [ ] Email provider configured (Resend with verified domain)
- [ ] Custom domains configured (if applicable)
- [ ] Monitoring/alerting set up
- [ ] Backup strategy verified

### Deploy to Production

Once ready, simply push to `main` branch:

```bash
git push origin main
```

This will trigger the production deployment workflow which will:
1. Run full test suite
2. Deploy all workers to production
3. Deploy all frontend apps to production
4. Run health checks

Or deploy manually:

```bash
# Deploy workers
cd apps/api && npx wrangler deploy --env production
cd workers/queue-processor && npx wrangler deploy --env production
cd workers/realtime && npx wrangler deploy --env production
cd workers/ai-gateway && npx wrangler deploy --env production
cd workers/cron-scheduler && npx wrangler deploy --env production

# Deploy frontend apps
cd apps/web-attendee
npm run build
npx wrangler pages deploy dist --project-name=retreatflow360-attendee --branch=main

cd ../web-owner
npm run build
npx wrangler pages deploy dist --project-name=retreatflow360-owner --branch=main

cd ../web-admin
npm run build
npx wrangler pages deploy dist --project-name=retreatflow360-admin --branch=main
```

## 📚 Documentation

- [DEPLOYMENT_STATUS.md](DEPLOYMENT_STATUS.md) - Current deployment status and resources
- [CLOUDFLARE_RESOURCES.md](CLOUDFLARE_RESOURCES.md) - Complete resource inventory
- [GITHUB_SETUP.md](GITHUB_SETUP.md) - GitHub variables and secrets setup
- [SETUP.md](SETUP.md) - Local development setup guide
- [README.md](README.md) - Project overview and quick start

## 🔗 Useful Links

### Cloudflare Dashboards
- **Workers:** https://dash.cloudflare.com/1e54c42267499cd9093c467c8b5517d1/workers
- **D1 Databases:** https://dash.cloudflare.com/1e54c42267499cd9093c467c8b5517d1/workers/d1
- **R2 Buckets:** https://dash.cloudflare.com/1e54c42267499cd9093c467c8b5517d1/r2
- **Pages:** https://dash.cloudflare.com/1e54c42267499cd9093c467c8b5517d1/pages
- **Queues:** https://dash.cloudflare.com/1e54c42267499cd9093c467c8b5517d1/queues

### External Services
- **Stripe Dashboard:** https://dashboard.stripe.com/
- **Resend Dashboard:** https://resend.com/
- **Cloudflare Turnstile:** https://dash.cloudflare.com/turnstile

## 🆘 Getting Help

If you encounter issues:

1. Check [DEPLOYMENT_STATUS.md](DEPLOYMENT_STATUS.md) troubleshooting section
2. Review worker logs: `npx wrangler tail <worker-name>`
3. Check GitHub Actions logs for deployment failures
4. Verify all secrets are set: `npx wrangler secret list --env staging`

## 🎉 Summary

You now have:
- ✅ Complete backend infrastructure deployed to staging
- ✅ All Cloudflare resources created for staging and production
- ✅ Frontend Pages projects created and ready to deploy
- ✅ CI/CD pipelines configured
- ✅ Comprehensive documentation

**Next action:** Configure secrets using `./scripts/setup-secrets.sh`
