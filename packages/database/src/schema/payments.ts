import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { tenants } from './tenants';
import { bookings } from './bookings';

export const payments = sqliteTable(
  'payments',
  {
    id: text('id').primaryKey(),
    bookingId: text('booking_id')
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    amount: real('amount').notNull(),
    currency: text('currency').notNull(),
    status: text('status', {
      enum: ['pending', 'processing', 'succeeded', 'failed', 'refunded', 'partially_refunded'],
    })
      .notNull()
      .default('pending'),
    provider: text('provider', {
      enum: ['stripe', 'paypal', 'gocardless'],
    }).notNull(),
    providerPaymentIntentId: text('provider_payment_intent_id'),
    providerChargeId: text('provider_charge_id'),
    paymentMethod: text('payment_method'),
    metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>().default({}),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
    completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
  },
  (table) => [
    index('payments_booking_idx').on(table.bookingId),
    index('payments_tenant_idx').on(table.tenantId),
    index('payments_status_idx').on(table.status),
    index('payments_provider_idx').on(table.provider, table.providerPaymentIntentId),
  ]
);

export const paymentPlans = sqliteTable(
  'payment_plans',
  {
    id: text('id').primaryKey(),
    bookingId: text('booking_id')
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    totalAmount: real('total_amount').notNull(),
    currency: text('currency').notNull(),
    installmentCount: integer('installment_count').notNull(),
    status: text('status', {
      enum: ['active', 'completed', 'cancelled', 'defaulted'],
    })
      .notNull()
      .default('active'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [index('plans_booking_idx').on(table.bookingId)]
);

export const paymentInstallments = sqliteTable(
  'payment_installments',
  {
    id: text('id').primaryKey(),
    paymentPlanId: text('payment_plan_id')
      .notNull()
      .references(() => paymentPlans.id, { onDelete: 'cascade' }),
    paymentId: text('payment_id').references(() => payments.id, { onDelete: 'set null' }),
    amount: real('amount').notNull(),
    dueDate: integer('due_date', { mode: 'timestamp_ms' }).notNull(),
    status: text('status', {
      enum: ['pending', 'paid', 'overdue', 'failed'],
    })
      .notNull()
      .default('pending'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    index('installments_plan_idx').on(table.paymentPlanId),
    index('installments_due_idx').on(table.dueDate, table.status),
  ]
);

export const refunds = sqliteTable(
  'refunds',
  {
    id: text('id').primaryKey(),
    paymentId: text('payment_id')
      .notNull()
      .references(() => payments.id, { onDelete: 'cascade' }),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    amount: real('amount').notNull(),
    reason: text('reason'),
    status: text('status', {
      enum: ['pending', 'processing', 'succeeded', 'failed'],
    })
      .notNull()
      .default('pending'),
    providerRefundId: text('provider_refund_id'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
  },
  (table) => [index('refunds_payment_idx').on(table.paymentId)]
);

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
export type PaymentPlan = typeof paymentPlans.$inferSelect;
export type NewPaymentPlan = typeof paymentPlans.$inferInsert;
export type PaymentInstallment = typeof paymentInstallments.$inferSelect;
export type NewPaymentInstallment = typeof paymentInstallments.$inferInsert;
export type Refund = typeof refunds.$inferSelect;
export type NewRefund = typeof refunds.$inferInsert;
