import type { Database } from '@retreatflow360/database';

/**
 * Cloudflare Worker bindings available in the environment
 */
export interface Env {
  // D1 Database
  DB: D1Database;

  // KV Namespaces
  KV: KVNamespace;
  SESSIONS: KVNamespace;
  CACHE: KVNamespace;

  // R2 Bucket
  STORAGE: R2Bucket;

  // Queues
  NOTIFICATION_QUEUE: Queue;
  PAYMENT_QUEUE: Queue;

  // Durable Objects
  EVENT_COORDINATOR: DurableObjectNamespace;
  ROOM_LOCK: DurableObjectNamespace;

  // AI
  AI: Ai;

  // Vectorize
  VECTORIZE: VectorizeIndex;

  // Environment variables
  ENVIRONMENT: 'development' | 'staging' | 'production';
  JWT_SECRET: string;
  JWT_ISSUER: string;
  API_BASE_URL: string;
  FRONTEND_URL: string;

  // Microsoft OAuth
  MICROSOFT_CLIENT_ID: string;
  MICROSOFT_CLIENT_SECRET: string;
  MICROSOFT_TENANT_ID?: string;

  // Payment providers
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  PAYPAL_CLIENT_ID?: string;
  PAYPAL_CLIENT_SECRET?: string;
  PAYPAL_ENVIRONMENT?: 'sandbox' | 'live';
  GOCARDLESS_ACCESS_TOKEN?: string;
  GOCARDLESS_WEBHOOK_SECRET?: string;
  GOCARDLESS_ENVIRONMENT?: 'sandbox' | 'live';
  DEFAULT_PAYMENT_PROVIDER?: 'stripe' | 'paypal' | 'gocardless';

  // App URLs
  APP_URL?: string;

  // Email queue
  EMAIL_QUEUE?: Queue;

  // Resend
  RESEND_API_KEY: string;

  // Turnstile
  TURNSTILE_SECRET_KEY: string;

  // AI Gateway
  AI_GATEWAY_URL?: string;
}

/**
 * Context variables set by middleware
 */
export interface Variables {
  db: Database;
  requestId: string;
  tenant: {
    id: string;
    slug: string;
    name: string;
    subscriptionTier: string;
    featureFlags: Record<string, boolean>;
  } | null;
  user: {
    sub: string;
    email: string;
    role: string;
    tenantMemberships: Array<{
      tenantId: string;
      role: string;
      permissions: Record<string, boolean>;
    }>;
  } | null;
}
