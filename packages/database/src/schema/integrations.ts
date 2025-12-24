import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { tenants } from './tenants';
import { users } from './users';

/**
 * API Keys for public API access
 */
export const apiKeys = sqliteTable(
  'api_keys',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    // Store hashed key, prefix for identification
    keyPrefix: text('key_prefix').notNull(), // e.g., "rf360_"
    keyHash: text('key_hash').notNull(),
    // Permissions and scopes
    scopes: text('scopes', { mode: 'json' })
      .$type<string[]>()
      .notNull()
      .default(['events:read']),
    // Rate limiting
    rateLimit: integer('rate_limit').default(1000), // requests per hour
    // Expiration
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }),
    lastUsedAt: integer('last_used_at', { mode: 'timestamp_ms' }),
    // Status
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    revokedAt: integer('revoked_at', { mode: 'timestamp_ms' }),
  },
  (table) => [
    index('api_keys_tenant_idx').on(table.tenantId),
    index('api_keys_prefix_idx').on(table.keyPrefix),
  ]
);

/**
 * Webhooks for event notifications
 */
export const webhooks = sqliteTable(
  'webhooks',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    url: text('url').notNull(),
    // Secret for signature verification
    secret: text('secret').notNull(),
    // Events to subscribe to
    events: text('events', { mode: 'json' })
      .$type<string[]>()
      .notNull()
      .default([]),
    // Headers to include
    headers: text('headers', { mode: 'json' })
      .$type<Record<string, string>>()
      .default({}),
    // Status
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    // Retry configuration
    maxRetries: integer('max_retries').default(3),
    // Statistics
    lastTriggeredAt: integer('last_triggered_at', { mode: 'timestamp_ms' }),
    successCount: integer('success_count').default(0),
    failureCount: integer('failure_count').default(0),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [index('webhooks_tenant_idx').on(table.tenantId)]
);

/**
 * Webhook delivery logs
 */
export const webhookDeliveries = sqliteTable(
  'webhook_deliveries',
  {
    id: text('id').primaryKey(),
    webhookId: text('webhook_id')
      .notNull()
      .references(() => webhooks.id, { onDelete: 'cascade' }),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    // Event data
    eventType: text('event_type').notNull(),
    payload: text('payload', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
    // Response
    statusCode: integer('status_code'),
    responseBody: text('response_body'),
    // Timing
    duration: integer('duration'), // ms
    // Retry info
    attempt: integer('attempt').notNull().default(1),
    nextRetryAt: integer('next_retry_at', { mode: 'timestamp_ms' }),
    // Status
    status: text('status', {
      enum: ['pending', 'success', 'failed', 'retrying'],
    })
      .notNull()
      .default('pending'),
    error: text('error'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    index('webhook_deliveries_webhook_idx').on(table.webhookId),
    index('webhook_deliveries_status_idx').on(table.status),
  ]
);

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
export type Webhook = typeof webhooks.$inferSelect;
export type NewWebhook = typeof webhooks.$inferInsert;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type NewWebhookDelivery = typeof webhookDeliveries.$inferInsert;
