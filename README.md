# RetreatFlow360

A comprehensive multi-tenant SaaS platform for retreat management, built on the Cloudflare ecosystem.

## 🏗️ Architecture

This is a monorepo containing:

### Frontend Applications
- **web-attendee** - Attendee portal for browsing and booking retreats
- **web-owner** - Owner dashboard for managing retreats and venues
- **web-admin** - Global admin console for platform management

### Backend Services
- **api** - Main REST API (Hono on Cloudflare Workers)
- **queue-processor** - Handles async tasks (email, webhooks)
- **realtime** - WebSocket connections via Durable Objects
- **ai-gateway** - AI request routing and rate limiting
- **cron-scheduler** - Scheduled tasks and reminders

### Shared Packages
- **database** - D1 schema and Drizzle ORM
- **auth** - JWT, OAuth, RBAC
- **email** - React Email templates + Resend
- **payments** - Multi-provider payment abstraction (Stripe, PayPal, GoCardless)
- **validation** - Zod schemas
- **shared-types** - TypeScript types
- **ui** - Shared React component library

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- npm (not pnpm - this project uses npm workspaces)
- Cloudflare account (for deployment)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/RetreatFlow360.git
cd RetreatFlow360

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your credentials

# Copy frontend env files
cp apps/web-attendee/.env.example apps/web-attendee/.env.local
cp apps/web-owner/.env.example apps/web-owner/.env.local
cp apps/web-admin/.env.example apps/web-admin/.env.local
```

### Development

```bash
# Start all development servers
npm run dev

# Or start specific apps
npm run dev --workspace=@retreatflow360/api
npm run dev --workspace=@retreatflow360/web-attendee
npm run dev --workspace=@retreatflow360/web-owner
npm run dev --workspace=@retreatflow360/web-admin
```

This will start:
- API: http://localhost:8787
- Attendee Portal: http://localhost:5173
- Owner Dashboard: http://localhost:5174
- Admin Console: http://localhost:5175

### Database Setup

```bash
# Create D1 database (staging)
npx wrangler d1 create retreatflow360-db-staging

# Create D1 database (production)
npx wrangler d1 create retreatflow360-db-production

# Update wrangler.toml with database IDs

# Run migrations
cd packages/database
npm run db:migrate
```

## 🧪 Testing

### Type Checking
```bash
npm run type-check
```

### Unit Tests
```bash
npm test
```

### E2E Tests
```bash
cd e2e
npm ci
npx playwright install

# Run tests
npm test

# Run tests with UI
npm run test:ui

# Run tests in headed mode
npm run test:headed
```

## 📦 Building

```bash
# Build all packages and apps
npm run build

# Build specific package
npm run build --workspace=@retreatflow360/api
```

## 🚢 Deployment

### Staging
Push to `develop` branch to trigger automatic deployment to staging environment.

```bash
git push origin develop
```

### Production
Push to `main` branch to trigger automatic deployment to production environment.

```bash
git push origin main
```

### Manual Deployment

```bash
# Deploy API
cd apps/api
npx wrangler deploy --env production

# Deploy Workers
cd workers/queue-processor
npx wrangler deploy --env production

# Deploy Frontend (via Cloudflare Pages)
# This is handled automatically by GitHub Actions
```

## 🔑 Environment Variables

See [`.env.example`](./.env.example) for all available environment variables.

### Required Secrets (GitHub)
Set these in your GitHub repository secrets:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

### Required Variables (Cloudflare)
Set these in Cloudflare Workers settings:
- `JWT_SECRET`
- `STRIPE_SECRET_KEY`
- `RESEND_API_KEY`
- etc. (see .env.example)

## 📁 Project Structure

```
RetreatFlow360/
├── apps/
│   ├── api/                    # Main REST API
│   ├── web-attendee/           # Attendee portal
│   ├── web-owner/              # Owner dashboard
│   └── web-admin/              # Admin console
├── workers/
│   ├── queue-processor/        # Async task processor
│   ├── realtime/               # WebSocket handler
│   ├── ai-gateway/             # AI request router
│   └── cron-scheduler/         # Scheduled tasks
├── packages/
│   ├── database/               # D1 schema & ORM
│   ├── auth/                   # Authentication
│   ├── email/                  # Email templates
│   ├── payments/               # Payment providers
│   ├── validation/             # Zod schemas
│   ├── shared-types/           # TypeScript types
│   ├── ui/                     # Component library
│   └── config/                 # Shared configs
├── e2e/                        # Playwright tests
└── .github/workflows/          # CI/CD pipelines
```

## 🛠️ Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for build tooling
- **React Router** for navigation
- **TanStack Query** for server state
- **Tailwind CSS** + **Radix UI** for styling
- **Framer Motion** for animations

### Backend
- **Cloudflare Workers** (Hono framework)
- **D1** (SQLite database)
- **Durable Objects** (WebSockets, coordination)
- **KV** (sessions, cache)
- **R2** (file storage)
- **Queue** (async processing)
- **Workers AI** (embeddings, content generation)

### Infrastructure
- **Turborepo** for monorepo management
- **Drizzle ORM** for database
- **GitHub Actions** for CI/CD
- **Playwright** for E2E testing

## 🎯 Features

### Multi-tenant Architecture
- Subdomain and custom domain support
- Tenant isolation in shared database
- Per-tenant configuration and branding

### Event Management
- Create and manage retreat events
- Session scheduling with room allocation
- Waitlist support with automatic notifications
- Custom pricing tiers and installment plans

### Booking System
- Multi-step booking flow with validation
- Payment processing (Stripe, PayPal, GoCardless)
- Dietary and accessibility profile management
- Calendar integration (iCal export)

### AI-Powered Features
- Semantic event search with embeddings
- AI-generated event descriptions
- Smart content suggestions

### Admin Console
- Global analytics and metrics
- Tenant management
- System health monitoring

## 📄 API Documentation

The API is self-documenting via OpenAPI 3.0 specification.

- **Development**: http://localhost:8787/api/v1/docs
- **Staging**: https://api.staging.retreatflow360.com/api/v1/docs
- **Production**: https://api.retreatflow360.com/api/v1/docs

## 🤝 Contributing

1. Create a feature branch from `develop`
2. Make your changes
3. Run tests: `npm test` and `npm run type-check`
4. Create a pull request to `develop`

## 📝 License

Copyright © 2025 RetreatFlow360. All rights reserved.

## 🔗 Links

- [API Documentation](https://api.retreatflow360.com/api/v1/docs)
- [High-Level Design](./DESIGN.md)
- [Deployment Guide](./docs/deployment.md)
