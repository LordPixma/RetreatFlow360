import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { tenants } from './tenants';

export const venues = sqliteTable(
  'venues',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    address: text('address'),
    city: text('city'),
    country: text('country'),
    latitude: real('latitude'),
    longitude: real('longitude'),
    capacity: integer('capacity'),
    amenities: text('amenities', { mode: 'json' }).$type<string[]>().default([]),
    images: text('images', { mode: 'json' }).$type<string[]>().default([]),
    contactInfo: text('contact_info', { mode: 'json' })
      .$type<{
        email?: string;
        phone?: string;
        website?: string;
      }>()
      .default({}),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
  },
  (table) => [index('venues_tenant_idx').on(table.tenantId)]
);

export const rooms = sqliteTable(
  'rooms',
  {
    id: text('id').primaryKey(),
    venueId: text('venue_id')
      .notNull()
      .references(() => venues.id, { onDelete: 'cascade' }),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: text('type', {
      enum: ['single', 'double', 'twin', 'shared', 'suite', 'meeting', 'conference'],
    }).notNull(),
    capacity: integer('capacity').notNull(),
    pricePerNight: real('price_per_night'),
    currency: text('currency').default('USD'),
    accessibilityFeatures: text('accessibility_features', { mode: 'json' })
      .$type<string[]>()
      .default([]),
    amenities: text('amenities', { mode: 'json' }).$type<string[]>().default([]),
    images: text('images', { mode: 'json' }).$type<string[]>().default([]),
    floorNumber: integer('floor_number'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
  },
  (table) => [
    index('rooms_venue_idx').on(table.venueId),
    index('rooms_tenant_idx').on(table.tenantId),
  ]
);

export const events = sqliteTable(
  'events',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    venueId: text('venue_id').references(() => venues.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    shortDescription: text('short_description'),
    startDate: integer('start_date', { mode: 'timestamp_ms' }).notNull(),
    endDate: integer('end_date', { mode: 'timestamp_ms' }).notNull(),
    timezone: text('timezone').default('UTC'),
    maxAttendees: integer('max_attendees'),
    status: text('status', {
      enum: ['draft', 'published', 'cancelled', 'completed'],
    })
      .notNull()
      .default('draft'),
    visibility: text('visibility', {
      enum: ['public', 'private', 'unlisted'],
    })
      .notNull()
      .default('public'),
    pricingTiers: text('pricing_tiers', { mode: 'json' })
      .$type<
        Array<{
          id: string;
          name: string;
          price: number;
          currency: string;
          description?: string;
          maxQuantity?: number;
          availableFrom?: number;
          availableUntil?: number;
        }>
      >()
      .default([]),
    customFields: text('custom_fields', { mode: 'json' })
      .$type<
        Array<{
          id: string;
          name: string;
          type: 'text' | 'select' | 'checkbox' | 'number' | 'date';
          required: boolean;
          options?: string[];
        }>
      >()
      .default([]),
    settings: text('settings', { mode: 'json' })
      .$type<{
        requireApproval?: boolean;
        allowWaitlist?: boolean;
        sendReminders?: boolean;
        reminderDays?: number[];
      }>()
      .default({}),
    images: text('images', { mode: 'json' }).$type<string[]>().default([]),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
    publishedAt: integer('published_at', { mode: 'timestamp_ms' }),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
  },
  (table) => [
    index('events_tenant_idx').on(table.tenantId),
    index('events_slug_idx').on(table.tenantId, table.slug),
    index('events_status_idx').on(table.status),
    index('events_dates_idx').on(table.startDate, table.endDate),
  ]
);

export const eventSessions = sqliteTable(
  'event_sessions',
  {
    id: text('id').primaryKey(),
    eventId: text('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    startTime: integer('start_time', { mode: 'timestamp_ms' }).notNull(),
    endTime: integer('end_time', { mode: 'timestamp_ms' }).notNull(),
    roomId: text('room_id').references(() => rooms.id, { onDelete: 'set null' }),
    maxParticipants: integer('max_participants'),
    sessionType: text('session_type', {
      enum: ['workshop', 'lecture', 'meal', 'break', 'activity', 'free_time', 'other'],
    }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [index('sessions_event_idx').on(table.eventId)]
);

export type Venue = typeof venues.$inferSelect;
export type NewVenue = typeof venues.$inferInsert;
export type Room = typeof rooms.$inferSelect;
export type NewRoom = typeof rooms.$inferInsert;
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type EventSession = typeof eventSessions.$inferSelect;
export type NewEventSession = typeof eventSessions.$inferInsert;
