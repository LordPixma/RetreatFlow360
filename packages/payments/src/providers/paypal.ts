/**
 * PayPal Payment Provider
 *
 * Implements the PaymentProvider interface for PayPal
 * Uses PayPal REST API directly for Cloudflare Workers compatibility
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
  PayPalConfig,
} from '../types';

const PAYPAL_API_SANDBOX = 'https://api-m.sandbox.paypal.com';
const PAYPAL_API_LIVE = 'https://api-m.paypal.com';

interface PayPalOrderResponse {
  id: string;
  status: string;
  links: Array<{
    href: string;
    rel: string;
    method: string;
  }>;
  purchase_units?: Array<{
    reference_id: string;
    amount: {
      currency_code: string;
      value: string;
    };
    payments?: {
      captures?: Array<{
        id: string;
        status: string;
        amount: {
          currency_code: string;
          value: string;
        };
      }>;
    };
  }>;
}

interface PayPalCaptureResponse {
  id: string;
  status: string;
  purchase_units: Array<{
    payments: {
      captures: Array<{
        id: string;
        status: string;
        amount: {
          currency_code: string;
          value: string;
        };
      }>;
    };
  }>;
}

interface PayPalRefundResponse {
  id: string;
  status: string;
  amount: {
    currency_code: string;
    value: string;
  };
}

function mapPayPalStatus(paypalStatus: string): PaymentStatus {
  switch (paypalStatus) {
    case 'CREATED':
    case 'SAVED':
    case 'APPROVED':
      return 'pending';
    case 'PAYER_ACTION_REQUIRED':
      return 'requires_action';
    case 'COMPLETED':
    case 'CAPTURED':
      return 'succeeded';
    case 'VOIDED':
      return 'cancelled';
    default:
      return 'failed';
  }
}

export class PayPalProvider implements PaymentProvider {
  readonly name: PaymentProviderName = 'paypal';
  private clientId: string;
  private clientSecret: string;
  private baseUrl: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(config: PayPalConfig) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.baseUrl = config.environment === 'live' ? PAYPAL_API_LIVE : PAYPAL_API_SANDBOX;
  }

  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const auth = btoa(`${this.clientId}:${this.clientSecret}`);

    const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      throw new Error('Failed to get PayPal access token');
    }

    const data = (await response.json()) as { access_token: string; expires_in: number };
    this.accessToken = data.access_token;
    // Set expiry 5 minutes before actual expiry for safety
    this.tokenExpiry = Date.now() + (data.expires_in - 300) * 1000;

    return this.accessToken;
  }

  private async request<T>(
    method: string,
    endpoint: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const token = await this.getAccessToken();

    const options: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, options);
    const data = (await response.json()) as T & { message?: string };

    if (!response.ok) {
      throw new Error(data.message || 'PayPal API error');
    }

    return data;
  }

  async createPaymentIntent(request: CreatePaymentIntentRequest): Promise<PaymentIntent> {
    // Convert amount from cents to dollars (PayPal uses decimal format)
    const amountValue = (request.amount.amount / 100).toFixed(2);

    const order = await this.request<PayPalOrderResponse>('POST', '/v2/checkout/orders', {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: request.bookingId,
          description: request.description || `Booking ${request.bookingId}`,
          amount: {
            currency_code: request.amount.currency.toUpperCase(),
            value: amountValue,
          },
          custom_id: request.tenantId,
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            return_url: request.returnUrl,
            cancel_url: request.cancelUrl,
            user_action: 'PAY_NOW',
          },
        },
      },
    });

    // Find the approval URL
    const approvalLink = order.links.find((l) => l.rel === 'payer-action' || l.rel === 'approve');

    return {
      id: order.id,
      providerIntentId: order.id,
      provider: 'paypal',
      amount: request.amount,
      status: mapPayPalStatus(order.status),
      redirectUrl: approvalLink?.href,
      metadata: request.metadata,
    };
  }

  async confirmPayment(request: ConfirmPaymentRequest): Promise<PaymentResult> {
    try {
      // Capture the order
      const capture = await this.request<PayPalCaptureResponse>(
        'POST',
        `/v2/checkout/orders/${request.paymentIntentId}/capture`
      );

      const captureResult = capture.purchase_units[0]?.payments.captures[0];
      const status = mapPayPalStatus(captureResult?.status || capture.status);

      return {
        success: status === 'succeeded',
        paymentId: capture.id,
        providerChargeId: captureResult?.id,
        status,
      };
    } catch (error) {
      return {
        success: false,
        status: 'failed',
        error: {
          code: 'CAPTURE_FAILED',
          message: error instanceof Error ? error.message : 'Payment capture failed',
        },
      };
    }
  }

  async cancelPayment(paymentIntentId: string): Promise<PaymentResult> {
    // PayPal orders expire automatically if not captured
    // We can void an authorized payment
    try {
      // Get order status first
      const order = await this.request<PayPalOrderResponse>(
        'GET',
        `/v2/checkout/orders/${paymentIntentId}`
      );

      if (order.status === 'COMPLETED') {
        return {
          success: false,
          status: 'failed',
          error: {
            code: 'ALREADY_CAPTURED',
            message: 'Cannot cancel a captured payment',
          },
        };
      }

      // Orders that are not captured will expire
      return {
        success: true,
        paymentId: paymentIntentId,
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
    // Convert amount from cents to dollars
    const amountValue = (request.amount.amount / 100).toFixed(2);

    try {
      const refund = await this.request<PayPalRefundResponse>(
        'POST',
        `/v2/payments/captures/${request.providerChargeId}/refund`,
        {
          amount: {
            value: amountValue,
            currency_code: request.amount.currency.toUpperCase(),
          },
          note_to_payer: request.reason,
        }
      );

      return {
        success: refund.status === 'COMPLETED',
        refundId: refund.id,
        providerRefundId: refund.id,
        status: refund.status === 'COMPLETED' ? 'succeeded' : 'processing',
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
    _signature: string
  ): Promise<WebhookVerificationResult> {
    try {
      const payloadString = typeof payload === 'string' ? payload : new TextDecoder().decode(payload);
      const event = JSON.parse(payloadString) as {
        id: string;
        event_type: string;
        create_time: string;
        resource: Record<string, unknown>;
      };

      // Note: Full webhook verification requires calling PayPal's API
      // For production, implement proper signature verification
      // https://developer.paypal.com/docs/api/webhooks/v1/#verify-webhook-signature

      return {
        valid: true,
        event: {
          id: event.id,
          provider: 'paypal',
          type: event.event_type,
          livemode: this.baseUrl === PAYPAL_API_LIVE,
          created: new Date(event.create_time).getTime() / 1000,
          data: {
            paymentIntentId: event.resource.id as string,
            status: event.resource.status as string,
          },
          raw: event,
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
    const order = await this.request<PayPalOrderResponse>(
      'GET',
      `/v2/checkout/orders/${providerIntentId}`
    );

    return mapPayPalStatus(order.status);
  }
}
