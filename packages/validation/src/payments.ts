import { z } from 'zod';

/**
 * Payment provider enum
 */
export const paymentProviderSchema = z.enum(['stripe', 'paypal', 'gocardless']);

export type PaymentProvider = z.infer<typeof paymentProviderSchema>;

/**
 * Create payment intent validation
 */
export const createPaymentIntentSchema = z.object({
  bookingId: z.string().min(1, 'Booking ID is required'),
  provider: paymentProviderSchema,
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().length(3, 'Currency must be 3 characters'),
  paymentMethod: z.string().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

export type CreatePaymentIntentInput = z.infer<typeof createPaymentIntentSchema>;

/**
 * Confirm payment validation
 */
export const confirmPaymentSchema = z.object({
  paymentId: z.string().min(1, 'Payment ID is required'),
  paymentMethodId: z.string().optional(),
});

export type ConfirmPaymentInput = z.infer<typeof confirmPaymentSchema>;

/**
 * Create refund validation
 */
export const createRefundSchema = z.object({
  paymentId: z.string().min(1, 'Payment ID is required'),
  amount: z.number().positive('Amount must be positive'),
  reason: z.string().min(1, 'Reason is required').max(500),
});

export type CreateRefundInput = z.infer<typeof createRefundSchema>;

/**
 * List payments query validation
 */
export const listPaymentsSchema = z.object({
  page: z.coerce.number().positive().default(1),
  limit: z.coerce.number().positive().max(100).default(20),
  bookingId: z.string().optional(),
  status: z.enum(['pending', 'processing', 'completed', 'failed', 'refunded']).optional(),
  provider: paymentProviderSchema.optional(),
  startDate: z.coerce.number().optional(),
  endDate: z.coerce.number().optional(),
  sortBy: z.enum(['createdAt', 'amount', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type ListPaymentsInput = z.infer<typeof listPaymentsSchema>;

/**
 * Create payment plan validation
 */
export const createPaymentPlanSchema = z.object({
  bookingId: z.string().min(1, 'Booking ID is required'),
  totalAmount: z.number().positive('Total amount must be positive'),
  currency: z.string().length(3, 'Currency must be 3 characters'),
  installmentCount: z.number().min(2, 'At least 2 installments required').max(12, 'Maximum 12 installments'),
  installmentDates: z.array(z.number().positive()).optional(),
});

export type CreatePaymentPlanInput = z.infer<typeof createPaymentPlanSchema>;

/**
 * Webhook payload validation (generic)
 */
export const webhookPayloadSchema = z.object({
  provider: paymentProviderSchema,
  signature: z.string().min(1, 'Signature is required'),
  payload: z.unknown(),
});

export type WebhookPayloadInput = z.infer<typeof webhookPayloadSchema>;

/**
 * Stripe-specific checkout session validation
 */
export const stripeCheckoutSchema = z.object({
  bookingId: z.string().min(1, 'Booking ID is required'),
  successUrl: z.string().url('Valid success URL required'),
  cancelUrl: z.string().url('Valid cancel URL required'),
  allowPromotionCodes: z.boolean().optional(),
});

export type StripeCheckoutInput = z.infer<typeof stripeCheckoutSchema>;

/**
 * PayPal order validation
 */
export const paypalOrderSchema = z.object({
  bookingId: z.string().min(1, 'Booking ID is required'),
  returnUrl: z.string().url('Valid return URL required'),
  cancelUrl: z.string().url('Valid cancel URL required'),
});

export type PaypalOrderInput = z.infer<typeof paypalOrderSchema>;

/**
 * GoCardless mandate validation
 */
export const gocardlessMandateSchema = z.object({
  bookingId: z.string().min(1, 'Booking ID is required'),
  redirectUrl: z.string().url('Valid redirect URL required'),
  customerEmail: z.string().email('Valid email required'),
  customerName: z.string().min(1, 'Customer name required'),
});

export type GocardlessMandateInput = z.infer<typeof gocardlessMandateSchema>;
