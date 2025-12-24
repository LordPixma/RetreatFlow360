import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { tenants } from './tenants';

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash'),
    role: text('role', {
      enum: ['global_admin', 'tenant_owner', 'tenant_admin', 'staff', 'attendee'],
    }).notNull(),
    emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
    mfaEnabled: integer('mfa_enabled', { mode: 'boolean' }).notNull().default(false),
    mfaSecret: text('mfa_secret'),
    profileData: text('profile_data', { mode: 'json' })
      .$type<{
        firstName?: string;
        lastName?: string;
        phone?: string;
        avatar?: string;
        bio?: string;
      }>()
      .default({}),
    dietaryRequirements: text('dietary_requirements', { mode: 'json' })
      .$type<{
        allergies?: string[];
        intolerances?: string[];
        preferences?: string[];
        notes?: string;
      }>()
      .default({}),
    accessibilityNeeds: text('accessibility_needs', { mode: 'json' })
      .$type<{
        mobility?: string[];
        visual?: string[];
        auditory?: string[];
        other?: string[];
        notes?: string;
      }>()
      .default({}),
    notificationPreferences: text('notification_preferences', { mode: 'json' })
      .$type<{
        email: {
          bookingConfirmation: boolean;
          paymentReceipt: boolean;
          eventReminders: boolean;
          eventUpdates: boolean;
          marketing: boolean;
        };
        reminderDaysBefore: number[];
      }>()
      .default({
        email: {
          bookingConfirmation: true,
          paymentReceipt: true,
          eventReminders: true,
          eventUpdates: true,
          marketing: false,
        },
        reminderDaysBefore: [7, 1],
      }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
  },
  (table) => [index('users_email_idx').on(table.email)]
);

export const userTenantMemberships = sqliteTable(
  'user_tenant_memberships',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    role: text('role', {
      enum: ['tenant_owner', 'tenant_admin', 'staff'],
    }).notNull(),
    permissions: text('permissions', { mode: 'json' }).$type<Record<string, boolean>>().default({}),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    index('membership_user_idx').on(table.userId),
    index('membership_tenant_idx').on(table.tenantId),
  ]
);

export const refreshTokens = sqliteTable(
  'refresh_tokens',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [index('refresh_token_user_idx').on(table.userId)]
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserTenantMembership = typeof userTenantMemberships.$inferSelect;
export type NewUserTenantMembership = typeof userTenantMemberships.$inferInsert;
export type RefreshToken = typeof refreshTokens.$inferSelect;
export type NewRefreshToken = typeof refreshTokens.$inferInsert;
