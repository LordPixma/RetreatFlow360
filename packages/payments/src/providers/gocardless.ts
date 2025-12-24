/**
 * GoCardless Payment Provider
 *
 * Implements the PaymentProvider interface for GoCardless
 * Handles direct debit payments (ACH, SEPA, Bacs, etc.)
 * Uses GoCardless REST API for Cloudflare Workers compatibility
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
  GoCardlessConfig,
} from '../types';

const GOCARDLESS_API_SANDBOX = 'https://api-sandbox.gocardless.com';
const GOCARDLESS_API_LIVE = 'https://api.gocardless.com';

interface GoCardlessPaymentResponse {
  payments: {
    id: string;
    created_at: string;
    charge_date: string;
    amount: number;
    currency: string;
    status: string;
    description?: string;
    metadata?: Record<string, string>;
    links: {
      mandate: string;
      creditor: string;
    };
  };
}

interface GoCardlessMandateResponse {
  mandates: {
    id: string;
    created_at: string;
    status: string;
    scheme: string;
    reference: string;
    links: {
      customer_bank_account: string;
      creditor: string;
      customer: string;
    };
  };
}

interface GoCardlessRedirectFlowResponse {
  redirect_flows: {
    id: string;
    description: string;
    session_token: string;
    scheme?: string;
    success_redirect_url: string;
    redirect_url: string;
    links: {
      creditor: string;
    };
  };
}

interface GoCardlessRedirectFlowCompleteResponse {
  redirect_flows: {
    id: string;
    confirmation_url: string;
    links: {
      customer: string;
      customer_bank_account: string;
      mandate: string;
    };
  };
}

interface GoCardlessRefundResponse {
  refunds: {
    id: string;
    created_at: string;
    amount: number;
    currency: string;
    status: string;
    metadata?: Record<string, string>;
    links: {
      payment: string;
      mandate: string;
    };
  };
}

interface GoCardlessWebhookEvent {
  id: string;
  created_at: string;
  action: string;
  resource_type: string;
  links: Record<string, string>;
  metadata?: Record<string, string>;
}

function mapGoCardlessStatus(gcStatus: string): PaymentStatus {
  switch (gcStatus) {
    case 'pending_customer_approval':
    case 'pending_submission':
    case 'submitted':
      return 'pending';
    case 'confirmed':
    case 'paid_out':
      return 'succeeded';
    case 'cancelled':
    case 'customer_approval_denied':
      return 'cancelled';
    case 'failed':
    case 'charged_back':
      return 'failed';
    default:
      return 'pending';
  }
}

export class GoCardlessProvider implements PaymentProvider {
  readonly name: PaymentProviderName = 'gocardless';
  private accessToken: string;
  private baseUrl: string;
  private webhookSecret: string;

  constructor(config: GoCardlessConfig) {
    this.accessToken = config.accessToken;
    this.webhookSecret = config.webhookSecret;
    this.baseUrl = config.environment === 'live' ? GOCARDLESS_API_LIVE : GOCARDLESS_API_SANDBOX;
  }

  private async request<T>(
    method: string,
    endpoint: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const options: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'GoCardless-Version': '2015-07-06',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, options);
    const data = (await response.json()) as T & { error?: { message?: string } };

    if (!response.ok) {
      throw new Error(data.error?.message || 'GoCardless API error');
    }

    return data;
  }

  async createPaymentIntent(request: CreatePaymentIntentRequest): Promise<PaymentIntent> {
    // GoCardless requires a mandate (direct debit authorization) before creating payments
    // If no mandate exists, we create a redirect flow to collect bank details

    const mandateId = request.metadata?.mandateId as string | undefined;

    if (mandateId) {
      // Create payment directly if mandate exists
      const payment = await this.request<GoCardlessPaymentResponse>('POST', '/payments', {
        payments: {
          amount: request.amount.amount, // GoCardless uses minor units
          currency: request.amount.currency.toUpperCase(),
          description: request.description || `Booking ${request.bookingId}`,
          metadata: {
            booking_id: request.bookingId,
            tenant_id: request.tenantId,
            ...((request.metadata as Record<string, string>) || {}),
          },
          links: {
            mandate: mandateId,
          },
        },
      });

      return {
        id: payment.payments.id,
        providerIntentId: payment.payments.id,
        provider: 'gocardless',
        amount: request.amount,
        status: mapGoCardlessStatus(payment.payments.status),
        metadata: request.metadata,
      };
    }

    // No mandate - create redirect flow to collect bank details
    const sessionToken = crypto.randomUUID();

    const redirectFlow = await this.request<GoCardlessRedirectFlowResponse>(
      'POST',
      '/redirect_flows',
      {
        redirect_flows: {
          description: request.description || `Payment for booking ${request.bookingId}`,
          session_token: sessionToken,
          success_redirect_url: request.returnUrl,
          scheme: this.getSchemeForCurrency(request.amount.currency),
          metadata: {
            booking_id: request.bookingId,
            tenant_id: request.tenantId,
            amount: String(request.amount.amount),
            currency: request.amount.currency,
          },
        },
      }
    );

    return {
      id: redirectFlow.redirect_flows.id,
      providerIntentId: redirectFlow.redirect_flows.id,
      provider: 'gocardless',
      amount: request.amount,
      status: 'requires_action',
      redirectUrl: redirectFlow.redirect_flows.redirect_url,
      metadata: {
        ...request.metadata,
        sessionToken,
        isRedirectFlow: 'true',
      },
    };
  }

  private getSchemeForCurrency(currency: string): string {
    switch (currency.toUpperCase()) {
      case 'GBP':
        return 'bacs';
      case 'EUR':
        return 'sepa_core';
      case 'USD':
        return 'ach';
      case 'SEK':
        return 'autogiro';
      case 'DKK':
        return 'betalingsservice';
      case 'AUD':
        return 'becs';
      case 'NZD':
        return 'becs_nz';
      case 'CAD':
        return 'pad';
      default:
        return 'sepa_core';
    }
  }

  async confirmPayment(request: ConfirmPaymentRequest): Promise<PaymentResult> {
    try {
      // Check if this is a redirect flow completion
      const isRedirectFlow = request.metadata?.isRedirectFlow === 'true' || request.metadata?.isRedirectFlow === true;

      if (isRedirectFlow) {
        // Complete the redirect flow to get the mandate
        const sessionToken = String(request.metadata?.sessionToken || '');

        const completedFlow = await this.request<GoCardlessRedirectFlowCompleteResponse>(
          'POST',
          `/redirect_flows/${request.paymentIntentId}/actions/complete`,
          {
            data: {
              session_token: sessionToken,
            },
          }
        );

        const mandateId = completedFlow.redirect_flows.links.mandate;

        // Now create the actual payment
        const amount = Number(request.metadata?.amount || 0);
        const currency = String(request.metadata?.currency || 'GBP');
        const bookingId = String(request.metadata?.bookingId || '');
        const tenantId = String(request.metadata?.tenantId || '');

        const payment = await this.request<GoCardlessPaymentResponse>('POST', '/payments', {
          payments: {
            amount: amount,
            currency: currency.toUpperCase(),
            description: `Booking ${bookingId}`,
            metadata: {
              booking_id: bookingId,
              tenant_id: tenantId,
            },
            links: {
              mandate: mandateId,
            },
          },
        });

        return {
          success: true,
          paymentId: payment.payments.id,
          providerChargeId: payment.payments.id,
          status: mapGoCardlessStatus(payment.payments.status),
        };
      }

      // For regular payments, just check the status
      const payment = await this.request<GoCardlessPaymentResponse>(
        'GET',
        `/payments/${request.paymentIntentId}`
      );

      const status = mapGoCardlessStatus(payment.payments.status);

      return {
        success: status === 'succeeded' || status === 'pending',
        paymentId: payment.payments.id,
        providerChargeId: payment.payments.id,
        status,
      };
    } catch (error) {
      return {
        success: false,
        status: 'failed',
        error: {
          code: 'CONFIRM_FAILED',
          message: error instanceof Error ? error.message : 'Payment confirmation failed',
        },
      };
    }
  }

  async cancelPayment(paymentIntentId: string): Promise<PaymentResult> {
    try {
      // Cancel the payment
      const payment = await this.request<GoCardlessPaymentResponse>(
        'POST',
        `/payments/${paymentIntentId}/actions/cancel`
      );

      return {
        success: true,
        paymentId: payment.payments.id,
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
    try {
      const refund = await this.request<GoCardlessRefundResponse>('POST', '/refunds', {
        refunds: {
          amount: request.amount.amount, // GoCardless uses minor units
          total_amount_confirmation: request.amount.amount,
          metadata: {
            reason: request.reason || '',
          },
          links: {
            payment: request.providerChargeId,
          },
        },
      });

      return {
        success: true,
        refundId: refund.refunds.id,
        providerRefundId: refund.refunds.id,
        status: refund.refunds.status === 'created' ? 'processing' : 'succeeded',
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

      // Verify the webhook signature
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(this.webhookSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadString));
      const computedSignature = Array.from(new Uint8Array(signatureBytes))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      if (computedSignature !== signature) {
        return {
          valid: false,
          error: 'Invalid webhook signature',
        };
      }

      const body = JSON.parse(payloadString) as { events: GoCardlessWebhookEvent[] };
      const event = body.events[0]; // GoCardless sends an array of events

      if (!event) {
        return {
          valid: false,
          error: 'No events in webhook payload',
        };
      }

      return {
        valid: true,
        event: {
          id: event.id,
          provider: 'gocardless',
          type: `${event.resource_type}.${event.action}`,
          livemode: this.baseUrl === GOCARDLESS_API_LIVE,
          created: new Date(event.created_at).getTime() / 1000,
          data: {
            paymentIntentId: event.links.payment || event.links.mandate,
            status: event.action,
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
    const payment = await this.request<GoCardlessPaymentResponse>(
      'GET',
      `/payments/${providerIntentId}`
    );

    return mapGoCardlessStatus(payment.payments.status);
  }

  /**
   * Get or create a mandate for a customer
   * This is useful for recurring payments
   */
  async getMandate(mandateId: string): Promise<{ id: string; status: string; scheme: string }> {
    const mandate = await this.request<GoCardlessMandateResponse>('GET', `/mandates/${mandateId}`);

    return {
      id: mandate.mandates.id,
      status: mandate.mandates.status,
      scheme: mandate.mandates.scheme,
    };
  }
}
