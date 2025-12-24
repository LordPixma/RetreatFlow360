import { z } from 'zod';

/**
 * Create booking validation
 */
export const createBookingSchema = z.object({
  eventId: z.string().min(1, 'Event ID is required'),
  pricingTier: z.string().min(1, 'Pricing tier is required'),
  roomId: z.string().optional(), // Optional room to allocate
  customFieldResponses: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  dietaryNotes: z.string().max(1000).optional(),
  accessibilityNotes: z.string().max(1000).optional(),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;

/**
 * Update booking validation
 */
export const updateBookingSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'cancelled', 'refunded', 'waitlisted']).optional(),
  roomAllocationId: z.string().optional(),
  customFieldResponses: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  dietaryNotes: z.string().max(1000).optional(),
  accessibilityNotes: z.string().max(1000).optional(),
  internalNotes: z.string().max(2000).optional(),
});

export type UpdateBookingInput = z.infer<typeof updateBookingSchema>;

/**
 * Cancel booking validation
 */
export const cancelBookingSchema = z.object({
  reason: z.string().min(1, 'Cancellation reason is required').max(500),
});

export type CancelBookingInput = z.infer<typeof cancelBookingSchema>;

/**
 * List bookings query validation
 */
export const listBookingsSchema = z.object({
  page: z.coerce.number().positive().default(1),
  limit: z.coerce.number().positive().max(100).default(20),
  eventId: z.string().optional(),
  userId: z.string().optional(),
  status: z.enum(['pending', 'confirmed', 'cancelled', 'refunded', 'waitlisted']).optional(),
  sortBy: z.enum(['createdAt', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type ListBookingsInput = z.infer<typeof listBookingsSchema>;

/**
 * Approve booking validation
 */
export const approveBookingSchema = z.object({
  bookingId: z.string().min(1, 'Booking ID is required'),
  notes: z.string().max(500).optional(),
});

export type ApproveBookingInput = z.infer<typeof approveBookingSchema>;

/**
 * Room allocation validation
 */
export const createRoomAllocationSchema = z
  .object({
    roomId: z.string().min(1, 'Room ID is required'),
    eventId: z.string().min(1, 'Event ID is required'),
    bookingId: z.string().optional(),
    checkInDate: z.number().positive('Check-in date is required'),
    checkOutDate: z.number().positive('Check-out date is required'),
  })
  .refine((data) => data.checkOutDate > data.checkInDate, {
    message: 'Check-out date must be after check-in date',
    path: ['checkOutDate'],
  });

export type CreateRoomAllocationInput = z.infer<typeof createRoomAllocationSchema>;

/**
 * Waitlist entry validation
 */
export const createWaitlistEntrySchema = z.object({
  eventId: z.string().min(1, 'Event ID is required'),
  pricingTier: z.string().optional(),
});

export type CreateWaitlistEntryInput = z.infer<typeof createWaitlistEntrySchema>;
