/**
 * Payment Webhook Handler
 *
 * Processes payment webhooks from the queue
 */

import { createDb } from '@retreatflow360/database';
import { payments, bookings } from '@retreatflow360/database/schema';
import { eq } from 'drizzle-orm';
import type { WebhookEvent, PaymentStatus } from '@retreatflow360/payments';

interface PaymentWebhookMessage {
  type: 'payment_webhook';
  provider: 'stripe' | 'paypal' | 'gocardless';
  event: WebhookEvent;
}

interface Env {
  DB: D1Database;
  EMAIL_QUEUE: Queue;
}

/**
 * Map provider event type to payment status
 */
function getPaymentStatus(provider: string, eventType: string): PaymentStatus | null {
  // Stripe events
  if (provider === 'stripe') {
    switch (eventType) {
      case 'payment_intent.succeeded':
        return 'succeeded';
      case 'payment_intent.processing':
        return 'processing';
      case 'payment_intent.payment_failed':
        return 'failed';
      case 'payment_intent.canceled':
        return 'cancelled';
      case 'charge.refunded':
        return 'refunded';
      case 'charge.refund.updated':
        return 'partially_refunded';
      default:
        return null;
    }
  }

  // PayPal events
  if (provider === 'paypal') {
    switch (eventType) {
      case 'PAYMENT.CAPTURE.COMPLETED':
        return 'succeeded';
      case 'PAYMENT.CAPTURE.DENIED':
        return 'failed';
      case 'PAYMENT.CAPTURE.REFUNDED':
        return 'refunded';
      default:
        return null;
    }
  }

  // GoCardless events
  if (provider === 'gocardless') {
    switch (eventType) {
      case 'payments.confirmed':
      case 'payments.paid_out':
        return 'succeeded';
      case 'payments.failed':
        return 'failed';
      case 'payments.cancelled':
        return 'cancelled';
      case 'refunds.paid':
        return 'refunded';
      default:
        return null;
    }
  }

  return null;
}

export async function handlePaymentWebhook(
  message: PaymentWebhookMessage,
  env: Env
): Promise<void> {
  const { provider, event } = message;
  const { paymentIntentId, status } = event.data;

  if (!paymentIntentId) {
    console.log('No payment intent ID in webhook event');
    return;
  }

  const database = createDb(env.DB);

  // Find the payment by provider payment intent ID
  const [payment] = await database
    .select()
    .from(payments)
    .where(eq(payments.providerPaymentIntentId, paymentIntentId));

  if (!payment) {
    console.log(`Payment not found for intent: ${paymentIntentId}`);
    return;
  }

  // Determine the new status
  const newStatus = getPaymentStatus(provider, event.type);
  if (!newStatus) {
    console.log(`Unhandled event type: ${event.type}`);
    return;
  }

  // Map to DB status (cancelled is not in DB enum, use failed)
  const dbStatus = newStatus === 'cancelled' ? 'failed' : newStatus;
  type DbPaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded' | 'partially_refunded';

  // Update payment status
  const now = new Date();
  await database
    .update(payments)
    .set({
      status: dbStatus as DbPaymentStatus,
      updatedAt: now,
      completedAt: newStatus === 'succeeded' ? now : payment.completedAt,
      metadata: {
        ...(payment.metadata as Record<string, unknown>),
        lastWebhookEvent: event.type,
        lastWebhookAt: now.getTime(),
      },
    })
    .where(eq(payments.id, payment.id));

  // If payment succeeded, update booking status
  if (newStatus === 'succeeded') {
    await database
      .update(bookings)
      .set({
        status: 'confirmed',
        updatedAt: now,
        confirmedAt: now,
      })
      .where(eq(bookings.id, payment.bookingId));

    // Queue confirmation email
    await env.EMAIL_QUEUE.send({
      type: 'booking_confirmation',
      bookingId: payment.bookingId,
      paymentId: payment.id,
      tenantId: payment.tenantId,
    });
  }

  // If payment failed, notify user
  if (newStatus === 'failed') {
    await env.EMAIL_QUEUE.send({
      type: 'payment_failed',
      bookingId: payment.bookingId,
      paymentId: payment.id,
      tenantId: payment.tenantId,
    });
  }

  // If refunded, update booking status
  if (newStatus === 'refunded') {
    await database
      .update(bookings)
      .set({
        status: 'refunded',
        updatedAt: now,
      })
      .where(eq(bookings.id, payment.bookingId));

    await env.EMAIL_QUEUE.send({
      type: 'refund_confirmation',
      bookingId: payment.bookingId,
      paymentId: payment.id,
      tenantId: payment.tenantId,
    });
  }

  console.log(`Processed ${event.type} for payment ${payment.id}, status: ${newStatus}`);
}
