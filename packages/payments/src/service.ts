/**
 * Payment Service
 *
 * Factory for creating payment providers and managing payments
 * Handles provider selection based on tenant configuration
 */

import type {
  PaymentProvider,
  PaymentProviderName,
  StripeConfig,
  PayPalConfig,
  GoCardlessConfig,
  CreatePaymentIntentRequest,
  PaymentIntent,
  ConfirmPaymentRequest,
  PaymentResult,
  RefundRequest,
  RefundResult,
  WebhookVerificationResult,
  PaymentStatus,
} from './types';

import { StripeProvider } from './providers/stripe';
import { PayPalProvider } from './providers/paypal';
import { GoCardlessProvider } from './providers/gocardless';

export type PaymentProviderConfig =
  | { provider: 'stripe'; config: StripeConfig }
  | { provider: 'paypal'; config: PayPalConfig }
  | { provider: 'gocardless'; config: GoCardlessConfig };

interface TenantPaymentConfig {
  tenantId: string;
  providers: PaymentProviderConfig[];
  defaultProvider: PaymentProviderName;
}

/**
 * Creates a payment provider instance based on configuration
 */
export function createPaymentProvider(config: PaymentProviderConfig): PaymentProvider {
  switch (config.provider) {
    case 'stripe':
      return new StripeProvider(config.config);
    case 'paypal':
      return new PayPalProvider(config.config);
    case 'gocardless':
      return new GoCardlessProvider(config.config);
    default:
      throw new Error(`Unknown payment provider: ${(config as PaymentProviderConfig).provider}`);
  }
}

/**
 * Payment Service class for managing payments across multiple providers
 */
export class PaymentService {
  private providers: Map<PaymentProviderName, PaymentProvider> = new Map();
  private defaultProvider: PaymentProviderName;
  private tenantId: string;

  constructor(config: TenantPaymentConfig) {
    this.tenantId = config.tenantId;
    this.defaultProvider = config.defaultProvider;

    for (const providerConfig of config.providers) {
      const provider = createPaymentProvider(providerConfig);
      this.providers.set(providerConfig.provider, provider);
    }
  }

  /**
   * Get a specific provider by name
   */
  getProvider(name: PaymentProviderName): PaymentProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`Payment provider '${name}' is not configured for this tenant`);
    }
    return provider;
  }

  /**
   * Get the default provider for this tenant
   */
  getDefaultProvider(): PaymentProvider {
    return this.getProvider(this.defaultProvider);
  }

  /**
   * Get list of available providers for this tenant
   */
  getAvailableProviders(): PaymentProviderName[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Create a payment intent using the specified or default provider
   */
  async createPaymentIntent(
    request: Omit<CreatePaymentIntentRequest, 'tenantId'>,
    providerName?: PaymentProviderName
  ): Promise<PaymentIntent> {
    const provider = providerName ? this.getProvider(providerName) : this.getDefaultProvider();

    return provider.createPaymentIntent({
      ...request,
      tenantId: this.tenantId,
    });
  }

  /**
   * Confirm a payment
   */
  async confirmPayment(
    request: ConfirmPaymentRequest,
    providerName: PaymentProviderName
  ): Promise<PaymentResult> {
    const provider = this.getProvider(providerName);
    return provider.confirmPayment(request);
  }

  /**
   * Cancel a payment
   */
  async cancelPayment(
    paymentIntentId: string,
    providerName: PaymentProviderName
  ): Promise<PaymentResult> {
    const provider = this.getProvider(providerName);
    return provider.cancelPayment(paymentIntentId);
  }

  /**
   * Process a refund
   */
  async refund(request: RefundRequest, providerName: PaymentProviderName): Promise<RefundResult> {
    const provider = this.getProvider(providerName);
    return provider.refund(request);
  }

  /**
   * Verify a webhook from a specific provider
   */
  async verifyWebhook(
    payload: string | ArrayBuffer,
    signature: string,
    providerName: PaymentProviderName
  ): Promise<WebhookVerificationResult> {
    const provider = this.getProvider(providerName);
    return provider.verifyWebhook(payload, signature);
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(
    providerIntentId: string,
    providerName: PaymentProviderName
  ): Promise<PaymentStatus> {
    const provider = this.getProvider(providerName);
    return provider.getPaymentStatus(providerIntentId);
  }
}

/**
 * Create a payment service from environment variables
 * This is useful for quick setup in Workers
 */
export function createPaymentServiceFromEnv(
  env: Record<string, string | undefined>,
  tenantId: string
): PaymentService {
  const providers: PaymentProviderConfig[] = [];

  // Check for Stripe configuration
  if (env.STRIPE_SECRET_KEY) {
    providers.push({
      provider: 'stripe',
      config: {
        secretKey: env.STRIPE_SECRET_KEY,
        webhookSecret: env.STRIPE_WEBHOOK_SECRET || '',
      },
    });
  }

  // Check for PayPal configuration
  if (env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET) {
    providers.push({
      provider: 'paypal',
      config: {
        clientId: env.PAYPAL_CLIENT_ID,
        clientSecret: env.PAYPAL_CLIENT_SECRET,
        environment: (env.PAYPAL_ENVIRONMENT as 'sandbox' | 'live') || 'sandbox',
      },
    });
  }

  // Check for GoCardless configuration
  if (env.GOCARDLESS_ACCESS_TOKEN) {
    providers.push({
      provider: 'gocardless',
      config: {
        accessToken: env.GOCARDLESS_ACCESS_TOKEN,
        webhookSecret: env.GOCARDLESS_WEBHOOK_SECRET || '',
        environment: (env.GOCARDLESS_ENVIRONMENT as 'sandbox' | 'live') || 'sandbox',
      },
    });
  }

  if (providers.length === 0) {
    throw new Error('No payment providers configured');
  }

  // Default to first configured provider
  const firstProvider = providers[0]!;
  const defaultProvider =
    (env.DEFAULT_PAYMENT_PROVIDER as PaymentProviderName) || firstProvider.provider;

  return new PaymentService({
    tenantId,
    providers,
    defaultProvider,
  });
}
