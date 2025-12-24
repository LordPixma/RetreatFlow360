import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { tenants } from './tenants';
import { users } from './users';
import { events, rooms } from './events';

export const roomAllocations = sqliteTable(
  'room_allocations',
  {
    id: text('id').primaryKey(),
    roomId: text('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    eventId: text('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    bookingId: text('booking_id'), // Set later when booking is confirmed
    checkInDate: integer('check_in_date', { mode: 'timestamp_ms' }).notNull(),
    checkOutDate: integer('check_out_date', { mode: 'timestamp_ms' }).notNull(),
    status: text('status', {
      enum: ['reserved', 'confirmed', 'checked_in', 'checked_out', 'cancelled'],
    })
      .notNull()
      .default('reserved'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    index('allocations_room_idx').on(table.roomId),
    index('allocations_event_idx').on(table.eventId),
    index('allocations_booking_idx').on(table.bookingId),
  ]
);

export const bookings = sqliteTable(
  'bookings',
  {
    id: text('id').primaryKey(),
    eventId: text('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    status: text('status', {
      enum: ['pending', 'confirmed', 'cancelled', 'refunded', 'waitlisted'],
    })
      .notNull()
      .default('pending'),
    pricingTier: text('pricing_tier').notNull(),
    baseAmount: real('base_amount').notNull(),
    currency: text('currency').notNull().default('USD'),
    roomAllocationId: text('room_allocation_id').references(() => roomAllocations.id, {
      onDelete: 'set null',
    }),
    customFieldResponses: text('custom_field_responses', { mode: 'json' })
      .$type<Record<string, string | number | boolean>>()
      .default({}),
    dietaryNotes: text('dietary_notes'),
    accessibilityNotes: text('accessibility_notes'),
    internalNotes: text('internal_notes'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
    confirmedAt: integer('confirmed_at', { mode: 'timestamp_ms' }),
    cancelledAt: integer('cancelled_at', { mode: 'timestamp_ms' }),
    cancellationReason: text('cancellation_reason'),
  },
  (table) => [
    index('bookings_event_idx').on(table.eventId),
    index('bookings_user_idx').on(table.userId),
    index('bookings_tenant_idx').on(table.tenantId),
    index('bookings_status_idx').on(table.status),
  ]
);

export const waitlistEntries = sqliteTable(
  'waitlist_entries',
  {
    id: text('id').primaryKey(),
    eventId: text('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    pricingTier: text('pricing_tier'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    notifiedAt: integer('notified_at', { mode: 'timestamp_ms' }),
  },
  (table) => [
    index('waitlist_event_idx').on(table.eventId),
    index('waitlist_position_idx').on(table.eventId, table.position),
  ]
);

export type RoomAllocation = typeof roomAllocations.$inferSelect;
export type NewRoomAllocation = typeof roomAllocations.$inferInsert;
export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;
export type WaitlistEntry = typeof waitlistEntries.$inferSelect;
export type NewWaitlistEntry = typeof waitlistEntries.$inferInsert;
