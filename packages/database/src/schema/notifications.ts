import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { users } from './users';
import { tenants } from './tenants';

/**
 * Notifications table - stores all notifications sent to users
 */
export const notifications = sqliteTable(
  'notifications',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    type: text('type', {
      enum: [
        'booking_confirmation',
        'payment_receipt',
        'payment_failed',
        'refund_confirmation',
        'event_reminder',
        'event_update',
        'event_cancelled',
        'welcome',
        'password_reset',
        'general',
      ],
    }).notNull(),
    channel: text('channel', {
      enum: ['email', 'in_app', 'sms'],
    }).notNull(),
    status: text('status', {
      enum: ['pending', 'sent', 'delivered', 'failed', 'read'],
    })
      .notNull()
      .default('pending'),
    subject: text('subject').notNull(),
    content: text('content'),
    metadata: text('metadata', { mode: 'json' })
      .$type<{
        eventId?: string;
        bookingId?: string;
        paymentId?: string;
        providerMessageId?: string;
        errorMessage?: string;
      }>()
      .default({}),
    readAt: integer('read_at', { mode: 'timestamp_ms' }),
    sentAt: integer('sent_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    index('notifications_user_idx').on(table.userId),
    index('notifications_tenant_idx').on(table.tenantId),
    index('notifications_type_idx').on(table.type),
    index('notifications_status_idx').on(table.status),
  ]
);

/**
 * Email templates table - stores custom email templates per tenant
 */
export const emailTemplates = sqliteTable(
  'email_templates',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    type: text('type', {
      enum: [
        'booking_confirmation',
        'payment_receipt',
        'payment_failed',
        'refund_confirmation',
        'event_reminder',
        'event_update',
        'event_cancelled',
        'welcome',
        'password_reset',
      ],
    }).notNull(),
    name: text('name').notNull(),
    subject: text('subject').notNull(),
    htmlContent: text('html_content').notNull(),
    variables: text('variables', { mode: 'json' }).$type<string[]>().default([]),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    index('templates_tenant_idx').on(table.tenantId),
    index('templates_type_idx').on(table.type),
  ]
);

/**
 * Scheduled notifications table - for event reminders and scheduled campaigns
 */
export const scheduledNotifications = sqliteTable(
  'scheduled_notifications',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    type: text('type', {
      enum: ['event_reminder', 'campaign', 'follow_up'],
    }).notNull(),
    status: text('status', {
      enum: ['scheduled', 'processing', 'completed', 'cancelled', 'failed'],
    })
      .notNull()
      .default('scheduled'),
    scheduledFor: integer('scheduled_for', { mode: 'timestamp_ms' }).notNull(),
    metadata: text('metadata', { mode: 'json' })
      .$type<{
        eventId?: string;
        campaignId?: string;
        userIds?: string[];
        templateId?: string;
        daysBeforeEvent?: number;
      }>()
      .default({}),
    processedAt: integer('processed_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    index('scheduled_tenant_idx').on(table.tenantId),
    index('scheduled_status_idx').on(table.status),
    index('scheduled_for_idx').on(table.scheduledFor),
  ]
);

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type NewEmailTemplate = typeof emailTemplates.$inferInsert;
export type ScheduledNotification = typeof scheduledNotifications.$inferSelect;
export type NewScheduledNotification = typeof scheduledNotifications.$inferInsert;
