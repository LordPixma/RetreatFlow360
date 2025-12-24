import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { tenants } from './tenants';
import { users } from './users';

export const auditLogs = sqliteTable(
  'audit_logs',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action', {
      enum: ['create', 'update', 'delete', 'login', 'logout', 'export', 'import'],
    }).notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id'),
    details: text('details', { mode: 'json' }).$type<Record<string, unknown>>(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    index('audit_tenant_idx').on(table.tenantId),
    index('audit_user_idx').on(table.userId),
    index('audit_resource_idx').on(table.resourceType, table.resourceId),
    index('audit_created_idx').on(table.createdAt),
  ]
);

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
