# Cloudflare Resources

This document contains all Cloudflare resource IDs created for the RetreatFlow360 platform.

## D1 Databases

### Staging
- **Name:** `retreatflow360-staging`
- **ID:** `d426f27b-8876-4ab8-8186-8e9fe1b65fe3`
- **Region:** WEUR (Western Europe)

### Production
- **Name:** `retreatflow360-prod`
- **ID:** `34aa0597-18b7-47e2-af4e-39c426b2450f`
- **Region:** WEUR (Western Europe)

## KV Namespaces

### Staging - Sessions
- **Binding:** `SESSIONS`
- **ID:** `2c4e3bed8b2840a69fd24ca843605d12`
- **Title:** `worker-staging-sessions`

### Staging - Cache
- **Binding:** `CACHE`
- **ID:** `166a0fb46ba34e65b6dd44b2088e7ca9`
- **Title:** `worker-staging-cache`

### Production - Sessions
- **Binding:** `SESSIONS`
- **ID:** `28045557813e47b092c1a63a16ad7df7`
- **Title:** `worker-production-sessions`

### Production - Cache
- **Binding:** `CACHE`
- **ID:** `9bf1df0458a1442284bb19f839ec1e24`
- **Title:** `worker-production-cache`

## R2 Buckets

### Staging
- **Name:** `retreatflow360-storage-staging`
- **Storage Class:** Standard

### Production
- **Name:** `retreatflow360-storage-prod`
- **Storage Class:** Standard

## Queues

### Staging - Notifications
- **Name:** `notifications-staging`
- **Used by:** API (producer), queue-processor (consumer)

### Staging - Payments
- **Name:** `payments-staging`
- **Used by:** API (producer), queue-processor (consumer)

### Production - Notifications
- **Name:** `notifications-prod`
- **Used by:** API (producer), queue-processor (consumer)

### Production - Payments
- **Name:** `payments-prod`
- **Used by:** API (producer), queue-processor (consumer)

## Vectorize Indexes (To Be Created)

These will be created automatically when first deploying the AI gateway:

### Development
- **Name:** `retreatflow360-events-dev`

### Staging
- **Name:** `retreatflow360-events-staging`

### Production
- **Name:** `retreatflow360-events-prod`

## Durable Objects

Deployed as part of the realtime worker:

- **EventBookingCoordinator** - Coordinates concurrent booking attempts
- **RoomAllocationLock** - Manages room allocation locking

## Next Steps

### 1. Run Database Migrations

```bash
# Staging
cd packages/database
npx wrangler d1 execute retreatflow360-staging --remote --file=./drizzle/schema.sql

# Production
npx wrangler d1 execute retreatflow360-prod --remote --file=./drizzle/schema.sql
```

### 2. Set Worker Secrets

You need to set the following secrets for each environment:

```bash
# Staging secrets
npx wrangler secret put JWT_SECRET --env staging
npx wrangler secret put STRIPE_SECRET_KEY --env staging
npx wrangler secret put STRIPE_WEBHOOK_SECRET --env staging
npx wrangler secret put RESEND_API_KEY --env staging
npx wrangler secret put TURNSTILE_SECRET_KEY --env staging

# Production secrets
npx wrangler secret put JWT_SECRET --env production
npx wrangler secret put STRIPE_SECRET_KEY --env production
npx wrangler secret put STRIPE_WEBHOOK_SECRET --env production
npx wrangler secret put RESEND_API_KEY --env production
npx wrangler secret put TURNSTILE_SECRET_KEY --env production
```

### 3. Create Cloudflare Pages Projects

Create these projects in the Cloudflare dashboard:

#### Staging
- `retreatflow360-attendee-staging` - Connect to GitHub, auto-deploy from `develop` branch
- `retreatflow360-owner-staging` - Connect to GitHub, auto-deploy from `develop` branch
- `retreatflow360-admin-staging` - Connect to GitHub, auto-deploy from `develop` branch

#### Production
- `retreatflow360-attendee` - Connect to GitHub, auto-deploy from `main` branch
- `retreatflow360-owner` - Connect to GitHub, auto-deploy from `main` branch
- `retreatflow360-admin` - Connect to GitHub, auto-deploy from `main` branch

### 4. Configure GitHub Secrets

Add these to your GitHub repository secrets:

- `CLOUDFLARE_API_TOKEN` - API token with Workers, D1, Pages permissions
- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID

### 5. Configure GitHub Variables

Add these to your GitHub repository variables:

- `STAGING_API_URL` - Your staging API URL (e.g., `https://api-staging.retreatflow360.workers.dev`)
- `PRODUCTION_API_URL` - Your production API URL (e.g., `https://api.retreatflow360.com`)

## Resource Usage & Limits

### Free Tier Limits (as of 2025)
- **D1:** 5 GB storage, 25M row reads/day, 100K row writes/day
- **KV:** 100K reads/day, 1K writes/day, 1 GB storage
- **R2:** 10 GB storage, 1M Class A operations/month, 10M Class B operations/month
- **Queues:** 1M operations/month
- **Workers:** 100K requests/day
- **Durable Objects:** 1M requests/month

## Monitoring

Monitor resource usage in the Cloudflare dashboard:
- https://dash.cloudflare.com/{account_id}/workers/analytics
- https://dash.cloudflare.com/{account_id}/workers/d1
- https://dash.cloudflare.com/{account_id}/r2/buckets

## Costs (Beyond Free Tier)

Estimated costs for production usage:

- **D1:** ~$0.75/GB/month + $1.00/billion reads
- **KV:** $0.50/GB/month + $0.50/million reads
- **R2:** $0.015/GB/month
- **Queues:** $0.40/million operations
- **Workers:** $0.30/million requests (Paid plan required)
- **Durable Objects:** $0.15/million requests

## Backup & Recovery

### D1 Databases
- Automatic daily backups (retained for 30 days on paid plan)
- Manual exports: `npx wrangler d1 export {database_name}`

### R2 Buckets
- Configure lifecycle policies in Cloudflare dashboard
- Consider cross-region replication for production

## Security Notes

- All resource IDs in this file are considered sensitive
- Never commit secrets to version control
- Use wrangler secrets for sensitive configuration
- Enable Cloudflare Access for admin endpoints
- Configure CORS policies for R2 buckets
