import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const tenants = sqliteTable('tenants', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  customDomain: text('custom_domain').unique(),
  subscriptionTier: text('subscription_tier', {
    enum: ['free', 'starter', 'professional', 'enterprise'],
  })
    .notNull()
    .default('free'),
  featureFlags: text('feature_flags', { mode: 'json' }).$type<Record<string, boolean>>().default({}),
  settings: text('settings', { mode: 'json' })
    .$type<{
      branding?: {
        primaryColor?: string;
        logo?: string;
      };
      timezone?: string;
      currency?: string;
    }>()
    .default({}),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
});

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
