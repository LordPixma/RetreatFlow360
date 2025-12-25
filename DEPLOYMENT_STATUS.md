# Deployment Status

Last Updated: 2025-12-25

## ✅ Staging Environment - LIVE

### Database
- **D1 Database:** `retreatflow360-staging` (d426f27b-8876-4ab8-8186-8e9fe1b65fe3)
- **Status:** ✅ Migrated
- **Tables:** 22 tables
- **Region:** WEUR (Western Europe)
- **Size:** 0.42 MB

### Workers Deployed

#### 1. API Worker
- **URL:** https://retreatflow360-api-staging.samuel-1e5.workers.dev
- **Status:** ✅ HEALTHY
- **Bindings:**
  - D1: retreatflow360-staging
  - KV: sessions (2c4e3bed8b2840a69fd24ca843605d12)
  - KV: cache (166a0fb46ba34e65b6dd44b2088e7ca9)
  - R2: retreatflow360-storage-staging
  - Queue Producer: notifications-staging
  - Queue Producer: payments-staging
- **Health Check:** Pass (198ms latency)

#### 2. Queue Processor
- **URL:** https://retreatflow360-queue-processor-staging.samuel-1e5.workers.dev
- **Status:** ✅ DEPLOYED
- **Bindings:**
  - Queue Consumer: notifications-staging
  - Queue Consumer: payments-staging

#### 3. Realtime Worker
- **URL:** https://retreatflow360-realtime-staging.samuel-1e5.workers.dev
- **Status:** ✅ DEPLOYED
- **Bindings:**
  - Durable Object: EventBookingCoordinator
  - Durable Object: RoomAllocationLock

#### 4. AI Gateway
- **URL:** https://retreatflow360-ai-gateway-staging.samuel-1e5.workers.dev
- **Status:** ✅ DEPLOYED
- **Bindings:**
  - Vectorize: retreatflow360-events-staging (768d, cosine)
  - Workers AI: Enabled

#### 5. Cron Scheduler
- **URL:** https://retreatflow360-cron-scheduler-staging.samuel-1e5.workers.dev
- **Status:** ✅ DEPLOYED
- **Schedule:** Every hour (0 * * * *)
- **Bindings:**
  - D1: retreatflow360-staging
  - Queue Producer: notifications-staging

### Storage Resources

#### R2 Bucket
- **Name:** retreatflow360-storage-staging
- **Status:** ✅ CREATED
- **Storage Class:** Standard

#### KV Namespaces
- **Sessions:** 2c4e3bed8b2840a69fd24ca843605d12
- **Cache:** 166a0fb46ba34e65b6dd44b2088e7ca9

#### Queues
- **notifications-staging:** ✅ Active (Producer: API, cron-scheduler | Consumer: queue-processor)
- **payments-staging:** ✅ Active (Producer: API | Consumer: queue-processor)

#### Vectorize Index
- **Name:** retreatflow360-events-staging
- **Dimensions:** 768
- **Metric:** cosine
- **Status:** ✅ CREATED

### Frontend Apps (Cloudflare Pages)

#### Attendee Portal
- **Project:** retreatflow360-attendee-staging
- **URL:** https://retreatflow360-attendee-staging.pages.dev
- **Status:** ✅ CREATED (not deployed yet)

#### Owner Dashboard
- **Project:** retreatflow360-owner-staging
- **URL:** https://retreatflow360-owner-staging.pages.dev
- **Status:** ✅ CREATED (not deployed yet)

#### Admin Console
- **Project:** retreatflow360-admin-staging
- **URL:** https://retreatflow360-admin-staging.pages.dev
- **Status:** ✅ CREATED (not deployed yet)

---

## 🔧 Production Environment - READY

### Database
- **D1 Database:** `retreatflow360-prod` (34aa0597-18b7-47e2-af4e-39c426b2450f)
- **Status:** ✅ Migrated
- **Tables:** 22 tables
- **Region:** WEUR (Western Europe)
- **Size:** 0.42 MB

### Workers
- **Status:** ⏸️ NOT DEPLOYED YET
- **Migrations:** ✅ Complete
- **Vectorize Index:** ✅ Created (retreatflow360-events-prod)

### Storage Resources

#### R2 Bucket
- **Name:** retreatflow360-storage-prod
- **Status:** ✅ CREATED

#### KV Namespaces
- **Sessions:** 28045557813e47b092c1a63a16ad7df7
- **Cache:** 9bf1df0458a1442284bb19f839ec1e24

#### Queues
- **notifications-prod:** ✅ CREATED
- **payments-prod:** ✅ CREATED

### Frontend Apps (Cloudflare Pages)

#### Attendee Portal
- **Project:** retreatflow360-attendee
- **URL:** https://retreatflow360-attendee.pages.dev
- **Status:** ✅ CREATED (not deployed yet)

#### Owner Dashboard
- **Project:** retreatflow360-owner
- **URL:** https://retreatflow360-owner.pages.dev
- **Status:** ✅ CREATED (not deployed yet)

#### Admin Console
- **Project:** retreatflow360-admin
- **URL:** https://retreatflow360-admin.pages.dev
- **Status:** ✅ CREATED (not deployed yet)

---

## 📋 Next Steps

### Immediate (Before Production Deployment)

1. **Set Worker Secrets** (REQUIRED)
   ```bash
   # Run the setup script
   ./scripts/setup-secrets.sh

   # Or manually:
   npx wrangler secret put JWT_SECRET --env production
   npx wrangler secret put STRIPE_SECRET_KEY --env production
   npx wrangler secret put STRIPE_WEBHOOK_SECRET --env production
   npx wrangler secret put RESEND_API_KEY --env production
   npx wrangler secret put TURNSTILE_SECRET_KEY --env production
   ```

2. **Create Cloudflare Pages Projects** ✅ COMPLETED
   - Staging projects:
     - `retreatflow360-attendee-staging` ✅
     - `retreatflow360-owner-staging` ✅
     - `retreatflow360-admin-staging` ✅
   - Production projects:
     - `retreatflow360-attendee` ✅
     - `retreatflow360-owner` ✅
     - `retreatflow360-admin` ✅

3. **Configure GitHub Secrets** ✅ COMPLETED
   - `CLOUDFLARE_API_TOKEN` - ✅ Already configured
   - `CLOUDFLARE_ACCOUNT_ID` - ✅ Already configured

4. **Configure GitHub Variables**
   - `STAGING_API_URL`: https://retreatflow360-api-staging.samuel-1e5.workers.dev
   - `PRODUCTION_API_URL`: (set after production deployment)

### Production Deployment

When ready to deploy to production:

```bash
# Deploy all workers to production
cd apps/api && npx wrangler deploy --env production
cd workers/queue-processor && npx wrangler deploy --env production
cd workers/realtime && npx wrangler deploy --env production
cd workers/ai-gateway && npx wrangler deploy --env production
cd workers/cron-scheduler && npx wrangler deploy --env production
```

Or trigger via GitHub Actions by pushing to `main` branch.

### Testing Checklist

#### Staging Environment
- [x] API Health Check
- [ ] User Registration
- [ ] User Login (JWT)
- [ ] Create Event
- [ ] Browse Events
- [ ] Create Booking
- [ ] Payment Processing (test mode)
- [ ] Email Notifications
- [ ] Queue Processing
- [ ] Cron Jobs
- [ ] File Upload (R2)
- [ ] AI Features (semantic search)

#### Production Environment
- [ ] All staging tests repeated
- [ ] Production secrets verified
- [ ] Monitoring configured
- [ ] Backups verified

---

## 🔍 Monitoring & Logs

### Cloudflare Dashboard
- **Workers Logs:** https://dash.cloudflare.com/1e54c42267499cd9093c467c8b5517d1/workers/analytics
- **D1 Database:** https://dash.cloudflare.com/1e54c42267499cd9093c467c8b5517d1/workers/d1
- **R2 Buckets:** https://dash.cloudflare.com/1e54c42267499cd9093c467c8b5517d1/r2/buckets
- **Queues:** https://dash.cloudflare.com/1e54c42267499cd9093c467c8b5517d1/queues

### Worker Logs
```bash
# Tail staging API logs
npx wrangler tail retreatflow360-api-staging

# Tail production API logs
npx wrangler tail retreatflow360-api
```

### Database Queries
```bash
# Query staging database
npx wrangler d1 execute retreatflow360-staging --remote --command="SELECT COUNT(*) FROM users"

# Query production database
npx wrangler d1 execute retreatflow360-prod --remote --command="SELECT COUNT(*) FROM users"
```

---

## 📊 Resource Usage (Free Tier)

### Current Usage
- **Workers:** 5 workers deployed to staging
- **D1:** 2 databases (0.42 MB each)
- **KV:** 4 namespaces
- **R2:** 2 buckets
- **Queues:** 4 queues
- **Vectorize:** 2 indexes

### Free Tier Limits
- ✅ Workers: 100K requests/day (currently ~0)
- ✅ D1: 5 GB storage (using 0.42 MB)
- ✅ KV: 100K reads/day, 1K writes/day
- ✅ R2: 10 GB storage
- ✅ Queues: 1M operations/month
- ✅ Durable Objects: 1M requests/month

All resources well within free tier limits! 🎉

---

## 🚨 Troubleshooting

### Common Issues

1. **Worker fails to deploy**
   - Check wrangler.toml for correct bindings
   - Verify all resources exist (D1, KV, R2, Queues)
   - Run `npx wrangler login` to refresh token

2. **Database errors**
   - Verify migrations ran: Check DEPLOYMENT_STATUS.md
   - Run health check: `curl https://retreatflow360-api-staging.samuel-1e5.workers.dev/health`

3. **Queue not processing**
   - Check queue-processor logs: `npx wrangler tail retreatflow360-queue-processor-staging`
   - Verify queue bindings in wrangler.toml

4. **Vectorize errors**
   - Ensure index exists: `npx wrangler vectorize list`
   - Recreate if needed: `npx wrangler vectorize create retreatflow360-events-staging --dimensions=768 --metric=cosine`

### Support
- Cloudflare Workers Docs: https://developers.cloudflare.com/workers/
- D1 Database Docs: https://developers.cloudflare.com/d1/
- Community Discord: https://discord.cloudflare.com
