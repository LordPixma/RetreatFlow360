/**
 * Payment Provider Abstraction Types
 *
 * Unified interface for multiple payment providers (Stripe, PayPal, GoCardless)
 */

export type PaymentProviderName = 'stripe' | 'paypal' | 'gocardless';

export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'requires_action'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'refunded'
  | 'partially_refunded';

export type RefundStatus = 'pending' | 'processing' | 'succeeded' | 'failed';

/**
 * Currency amount with ISO currency code
 */
export interface Money {
  amount: number; // In smallest currency unit (cents for USD)
  currency: string; // ISO 4217 currency code
}

/**
 * Customer information for payment processing
 */
export interface CustomerInfo {
  id?: string;
  email: string;
  name?: string;
  phone?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
}

/**
 * Payment intent creation request
 */
export interface CreatePaymentIntentRequest {
  amount: Money;
  customer: CustomerInfo;
  bookingId: string;
  tenantId: string;
  description?: string;
  metadata?: Record<string, string>;
  returnUrl?: string;
  cancelUrl?: string;
  paymentMethod?: string;
}

/**
 * Payment intent response from provider
 */
export interface PaymentIntent {
  id: string;
  providerIntentId: string;
  provider: PaymentProviderName;
  amount: Money;
  status: PaymentStatus;
  clientSecret?: string; // For Stripe Elements
  redirectUrl?: string; // For redirect-based flows
  expiresAt?: number;
  metadata?: Record<string, string>;
}

/**
 * Confirm payment request
 */
export interface ConfirmPaymentRequest {
  paymentIntentId: string;
  paymentMethodId?: string;
  returnUrl?: string;
  metadata?: Record<string, string | number | boolean>;
}

/**
 * Payment result after confirmation
 */
export interface PaymentResult {
  success: boolean;
  paymentId?: string;
  providerChargeId?: string;
  status: PaymentStatus;
  error?: {
    code: string;
    message: string;
    declineCode?: string;
  };
  requiresAction?: boolean;
  actionUrl?: string;
}

/**
 * Refund request
 */
export interface RefundRequest {
  paymentId: string;
  providerChargeId: string;
  amount: Money;
  reason?: string;
  metadata?: Record<string, string>;
}

/**
 * Refund result
 */
export interface RefundResult {
  success: boolean;
  refundId?: string;
  providerRefundId?: string;
  status: RefundStatus;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Webhook event from provider
 */
export interface WebhookEvent {
  id: string;
  provider: PaymentProviderName;
  type: string;
  livemode: boolean;
  created: number;
  data: {
    paymentIntentId?: string;
    chargeId?: string;
    refundId?: string;
    status?: string;
    amount?: Money;
    metadata?: Record<string, string>;
  };
  raw: unknown;
}

/**
 * Webhook verification result
 */
export interface WebhookVerificationResult {
  valid: boolean;
  event?: WebhookEvent;
  error?: string;
}

/**
 * Payment provider interface
 * All payment providers must implement this interface
 */
export interface PaymentProvider {
  readonly name: PaymentProviderName;

  /**
   * Create a payment intent for a booking
   */
  createPaymentIntent(request: CreatePaymentIntentRequest): Promise<PaymentIntent>;

  /**
   * Confirm a payment intent
   */
  confirmPayment(request: ConfirmPaymentRequest): Promise<PaymentResult>;

  /**
   * Cancel a payment intent
   */
  cancelPayment(paymentIntentId: string): Promise<PaymentResult>;

  /**
   * Process a refund
   */
  refund(request: RefundRequest): Promise<RefundResult>;

  /**
   * Verify and parse a webhook
   */
  verifyWebhook(payload: string | ArrayBuffer, signature: string): Promise<WebhookVerificationResult>;

  /**
   * Get payment status by provider payment intent ID
   */
  getPaymentStatus(providerIntentId: string): Promise<PaymentStatus>;
}

/**
 * Provider configuration
 */
export interface StripeConfig {
  secretKey: string;
  webhookSecret: string;
  apiVersion?: string;
}

export interface PayPalConfig {
  clientId: string;
  clientSecret: string;
  environment: 'sandbox' | 'live';
  webhookId?: string;
}

export interface GoCardlessConfig {
  accessToken: string;
  environment: 'sandbox' | 'live';
  webhookSecret: string;
}

export interface PaymentProviderConfig {
  stripe?: StripeConfig;
  paypal?: PayPalConfig;
  gocardless?: GoCardlessConfig;
}
