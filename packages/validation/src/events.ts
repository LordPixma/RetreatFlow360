import { z } from 'zod';

/**
 * Slug validation
 */
export const slugSchema = z
  .string()
  .min(1, 'Slug is required')
  .max(100, 'Slug must be less than 100 characters')
  .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens');

/**
 * Pricing tier validation
 */
export const pricingTierSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  price: z.number().nonnegative('Price must be non-negative'),
  currency: z.string().length(3, 'Currency must be 3 characters'),
  description: z.string().max(500).optional(),
  maxQuantity: z.number().positive('Max quantity must be positive').optional(),
  availableFrom: z.number().optional(),
  availableUntil: z.number().optional(),
});

export type PricingTierInput = z.infer<typeof pricingTierSchema>;

/**
 * Custom field validation
 */
export const customFieldSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  type: z.enum(['text', 'select', 'checkbox', 'number', 'date']),
  required: z.boolean(),
  options: z.array(z.string()).optional(),
});

export type CustomFieldInput = z.infer<typeof customFieldSchema>;

/**
 * Base event schema (without refinements)
 */
const baseEventSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be less than 200 characters'),
  slug: slugSchema.optional(),
  description: z.string().max(10000).optional(),
  shortDescription: z.string().max(500).optional(),
  startDate: z.number().positive('Start date is required'),
  endDate: z.number().positive('End date is required'),
  timezone: z.string().default('UTC'),
  maxAttendees: z.number().positive('Max attendees must be positive').optional(),
  venueId: z.string().optional(),
  visibility: z.enum(['public', 'private', 'unlisted']).default('public'),
  pricingTiers: z.array(pricingTierSchema).optional(),
  customFields: z.array(customFieldSchema).optional(),
  settings: z
    .object({
      requireApproval: z.boolean().optional(),
      allowWaitlist: z.boolean().optional(),
      sendReminders: z.boolean().optional(),
      reminderDays: z.array(z.number()).optional(),
    })
    .optional(),
});

/**
 * Create event validation
 */
export const createEventSchema = baseEventSchema.refine(
  (data) => data.endDate > data.startDate,
  {
    message: 'End date must be after start date',
    path: ['endDate'],
  }
);

export type CreateEventInput = z.infer<typeof createEventSchema>;

/**
 * Update event validation
 */
export const updateEventSchema = baseEventSchema.partial().extend({
  status: z.enum(['draft', 'published', 'cancelled']).optional(),
});

export type UpdateEventInput = z.infer<typeof updateEventSchema>;

/**
 * List events query validation
 */
export const listEventsSchema = z.object({
  page: z.coerce.number().positive().default(1),
  limit: z.coerce.number().positive().max(100).default(20),
  status: z.enum(['draft', 'published', 'cancelled', 'completed']).optional(),
  search: z.string().max(100).optional(),
  startAfter: z.coerce.number().optional(),
  startBefore: z.coerce.number().optional(),
  sortBy: z.enum(['startDate', 'createdAt', 'title']).default('startDate'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export type ListEventsInput = z.infer<typeof listEventsSchema>;

/**
 * Venue validation
 */
export const createVenueSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(5000).optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  capacity: z.number().positive().optional(),
  amenities: z.array(z.string()).optional(),
  contactInfo: z
    .object({
      email: z.string().email().optional(),
      phone: z.string().max(50).optional(),
      website: z.string().url().optional(),
    })
    .optional(),
});

export type CreateVenueInput = z.infer<typeof createVenueSchema>;

/**
 * Room validation
 */
export const createRoomSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  type: z.enum(['single', 'double', 'twin', 'shared', 'suite', 'meeting', 'conference']),
  capacity: z.number().positive('Capacity must be positive'),
  pricePerNight: z.number().nonnegative().optional(),
  currency: z.string().length(3).default('USD'),
  accessibilityFeatures: z.array(z.string()).optional(),
  amenities: z.array(z.string()).optional(),
  floorNumber: z.number().optional(),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;

/**
 * Event session validation
 */
const sessionBaseSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(2000).optional(),
  startTime: z.number().positive('Start time is required'),
  endTime: z.number().positive('End time is required'),
  roomId: z.string().optional(),
  maxParticipants: z.number().positive().optional(),
  sessionType: z.enum(['workshop', 'lecture', 'meal', 'break', 'activity', 'free_time', 'other']).optional(),
});

export const createSessionSchema = sessionBaseSchema.refine(
  (data) => data.endTime > data.startTime,
  {
    message: 'End time must be after start time',
    path: ['endTime'],
  }
);

export const updateSessionSchema = sessionBaseSchema.partial();

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;
