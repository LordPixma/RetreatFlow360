/**
 * Stripe Payment Provider
 *
 * Implements the PaymentProvider interface for Stripe
 * Uses the Stripe API directly (no SDK) for Cloudflare Workers compatibility
 */

import type {
  PaymentProvider,
  PaymentProviderName,
  CreatePaymentIntentRequest,
  PaymentIntent,
  ConfirmPaymentRequest,
  PaymentResult,
  RefundRequest,
  RefundResult,
  WebhookVerificationResult,
  PaymentStatus,
  StripeConfig,
} from '../types';

const STRIPE_API_BASE = 'https://api.stripe.com/v1';
const STRIPE_API_VERSION = '2024-11-20.acacia';

interface StripePaymentIntentResponse {
  id: string;
  object: string;
  amount: number;
  currency: string;
  status: string;
  client_secret: string;
  metadata?: Record<string, string>;
  last_payment_error?: {
    code: string;
    message: string;
    decline_code?: string;
  };
  next_action?: {
    type: string;
    redirect_to_url?: {
      url: string;
    };
  };
  latest_charge?: string;
}

interface StripeRefundResponse {
  id: string;
  object: string;
  amount: number;
  currency: string;
  status: string;
  payment_intent: string;
  reason?: string;
}

interface StripeWebhookEvent {
  id: string;
  object: string;
  type: string;
  livemode: boolean;
  created: number;
  data: {
    object: Record<string, unknown>;
  };
}

function mapStripeStatus(stripeStatus: string): PaymentStatus {
  switch (stripeStatus) {
    case 'requires_payment_method':
    case 'requires_confirmation':
      return 'pending';
    case 'requires_action':
      return 'requires_action';
    case 'processing':
      return 'processing';
    case 'succeeded':
      return 'succeeded';
    case 'canceled':
      return 'cancelled';
    default:
      return 'failed';
  }
}

export class StripeProvider implements PaymentProvider {
  readonly name: PaymentProviderName = 'stripe';
  private secretKey: string;
  private webhookSecret: string;
  private apiVersion: string;

  constructor(config: StripeConfig) {
    this.secretKey = config.secretKey;
    this.webhookSecret = config.webhookSecret;
    this.apiVersion = config.apiVersion || STRIPE_API_VERSION;
  }

  private async request<T>(
    method: string,
    endpoint: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const url = `${STRIPE_API_BASE}${endpoint}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': this.apiVersion,
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body) {
      options.body = this.encodeFormData(body);
    }

    const response = await fetch(url, options);
    const data = (await response.json()) as T & { error?: { code: string; message: string } };

    if (!response.ok) {
      throw new Error(data.error?.message || 'Stripe API error');
    }

    return data;
  }

  private encodeFormData(data: Record<string, unknown>, prefix = ''): string {
    const parts: string[] = [];

    for (const [key, value] of Object.entries(data)) {
      const fullKey = prefix ? `${prefix}[${key}]` : key;

      if (value === null || value === undefined) {
        continue;
      }

      if (typeof value === 'object' && !Array.isArray(value)) {
        parts.push(this.encodeFormData(value as Record<string, unknown>, fullKey));
      } else if (Array.isArray(value)) {
        value.forEach((item, index) => {
          if (typeof item === 'object') {
            parts.push(this.encodeFormData(item as Record<string, unknown>, `${fullKey}[${index}]`));
          } else {
            parts.push(`${encodeURIComponent(`${fullKey}[${index}]`)}=${encodeURIComponent(String(item))}`);
          }
        });
      } else {
        parts.push(`${encodeURIComponent(fullKey)}=${encodeURIComponent(String(value))}`);
      }
    }

    return parts.filter((p) => p).join('&');
  }

  async createPaymentIntent(request: CreatePaymentIntentRequest): Promise<PaymentIntent> {
    const metadata: Record<string, string> = {
      booking_id: request.bookingId,
      tenant_id: request.tenantId,
      ...request.metadata,
    };

    const body: Record<string, unknown> = {
      amount: request.amount.amount,
      currency: request.amount.currency.toLowerCase(),
      metadata,
      automatic_payment_methods: {
        enabled: true,
      },
    };

    if (request.description) {
      body.description = request.description;
    }

    if (request.customer.email) {
      body.receipt_email = request.customer.email;
    }

    if (request.returnUrl) {
      body.return_url = request.returnUrl;
    }

    const stripeIntent = await this.request<StripePaymentIntentResponse>(
      'POST',
      '/payment_intents',
      body
    );

    return {
      id: stripeIntent.id,
      providerIntentId: stripeIntent.id,
      provider: 'stripe',
      amount: {
        amount: stripeIntent.amount,
        currency: stripeIntent.currency.toUpperCase(),
      },
      status: mapStripeStatus(stripeIntent.status),
      clientSecret: stripeIntent.client_secret,
      metadata: stripeIntent.metadata,
    };
  }

  async confirmPayment(request: ConfirmPaymentRequest): Promise<PaymentResult> {
    const body: Record<string, unknown> = {};

    if (request.paymentMethodId) {
      body.payment_method = request.paymentMethodId;
    }

    if (request.returnUrl) {
      body.return_url = request.returnUrl;
    }

    try {
      const stripeIntent = await this.request<StripePaymentIntentResponse>(
        'POST',
        `/payment_intents/${request.paymentIntentId}/confirm`,
        body
      );

      const status = mapStripeStatus(stripeIntent.status);

      return {
        success: status === 'succeeded',
        paymentId: stripeIntent.id,
        providerChargeId: stripeIntent.latest_charge || undefined,
        status,
        requiresAction: status === 'requires_action',
        actionUrl: stripeIntent.next_action?.redirect_to_url?.url,
      };
    } catch (error) {
      return {
        success: false,
        status: 'failed',
        error: {
          code: 'PAYMENT_FAILED',
          message: error instanceof Error ? error.message : 'Payment confirmation failed',
        },
      };
    }
  }

  async cancelPayment(paymentIntentId: string): Promise<PaymentResult> {
    try {
      const stripeIntent = await this.request<StripePaymentIntentResponse>(
        'POST',
        `/payment_intents/${paymentIntentId}/cancel`
      );

      return {
        success: true,
        paymentId: stripeIntent.id,
        status: 'cancelled',
      };
    } catch (error) {
      return {
        success: false,
        status: 'failed',
        error: {
          code: 'CANCEL_FAILED',
          message: error instanceof Error ? error.message : 'Payment cancellation failed',
        },
      };
    }
  }

  async refund(request: RefundRequest): Promise<RefundResult> {
    const body: Record<string, unknown> = {
      payment_intent: request.providerChargeId,
      amount: request.amount.amount,
    };

    if (request.reason) {
      body.reason = 'requested_by_customer';
      body.metadata = {
        ...request.metadata,
        reason: request.reason,
      };
    }

    try {
      const stripeRefund = await this.request<StripeRefundResponse>('POST', '/refunds', body);

      return {
        success: stripeRefund.status === 'succeeded',
        refundId: stripeRefund.id,
        providerRefundId: stripeRefund.id,
        status: stripeRefund.status === 'succeeded' ? 'succeeded' : 'processing',
      };
    } catch (error) {
      return {
        success: false,
        status: 'failed',
        error: {
          code: 'REFUND_FAILED',
          message: error instanceof Error ? error.message : 'Refund failed',
        },
      };
    }
  }

  async verifyWebhook(
    payload: string | ArrayBuffer,
    signature: string
  ): Promise<WebhookVerificationResult> {
    try {
      const payloadString = typeof payload === 'string' ? payload : new TextDecoder().decode(payload);

      // Parse signature header
      const signatureParts = signature.split(',').reduce(
        (acc, part) => {
          const [key, value] = part.split('=');
          if (key === 't') acc.timestamp = value;
          if (key === 'v1') acc.signature = value;
          return acc;
        },
        {} as { timestamp?: string; signature?: string }
      );

      if (!signatureParts.timestamp || !signatureParts.signature) {
        return { valid: false, error: 'Invalid signature format' };
      }

      // Check timestamp (within 5 minutes)
      const timestamp = parseInt(signatureParts.timestamp, 10);
      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - timestamp) > 300) {
        return { valid: false, error: 'Webhook timestamp too old' };
      }

      // Verify signature
      const signedPayload = `${signatureParts.timestamp}.${payloadString}`;
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(this.webhookSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
      const expectedSignature = Array.from(new Uint8Array(signatureBytes))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      if (expectedSignature !== signatureParts.signature) {
        return { valid: false, error: 'Invalid signature' };
      }

      // Parse event
      const stripeEvent = JSON.parse(payloadString) as StripeWebhookEvent;
      const eventData = stripeEvent.data.object as Record<string, unknown>;

      return {
        valid: true,
        event: {
          id: stripeEvent.id,
          provider: 'stripe',
          type: stripeEvent.type,
          livemode: stripeEvent.livemode,
          created: stripeEvent.created,
          data: {
            paymentIntentId: eventData.id as string,
            chargeId: eventData.latest_charge as string,
            status: eventData.status as string,
            amount: eventData.amount
              ? {
                  amount: eventData.amount as number,
                  currency: (eventData.currency as string).toUpperCase(),
                }
              : undefined,
            metadata: eventData.metadata as Record<string, string>,
          },
          raw: stripeEvent,
        },
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Webhook verification failed',
      };
    }
  }

  async getPaymentStatus(providerIntentId: string): Promise<PaymentStatus> {
    const stripeIntent = await this.request<StripePaymentIntentResponse>(
      'GET',
      `/payment_intents/${providerIntentId}`
    );

    return mapStripeStatus(stripeIntent.status);
  }
}
