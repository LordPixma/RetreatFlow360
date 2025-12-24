/**
 * Payments Package
 *
 * Multi-provider payment integration for RetreatFlow360
 * Supports Stripe, PayPal, and GoCardless
 */

// Types
export type {
  PaymentProvider,
  PaymentProviderName,
  Money,
  CustomerInfo,
  CreatePaymentIntentRequest,
  PaymentIntent,
  ConfirmPaymentRequest,
  PaymentResult,
  RefundRequest,
  RefundResult,
  WebhookVerificationResult,
  WebhookEvent,
  PaymentStatus,
  RefundStatus,
  StripeConfig,
  PayPalConfig,
  GoCardlessConfig,
} from './types';

// Providers
export { StripeProvider } from './providers/stripe';
export { PayPalProvider } from './providers/paypal';
export { GoCardlessProvider } from './providers/gocardless';

// Service
export {
  PaymentService,
  createPaymentProvider,
  createPaymentServiceFromEnv,
  type PaymentProviderConfig,
} from './service';
