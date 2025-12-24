/**
 * Queue Processor Worker
 *
 * Processes messages from Cloudflare Queues:
 * - Payment webhooks
 * - Email notifications
 */

import { handlePaymentWebhook } from './handlers/payment';
import { handleEmailNotification } from './handlers/email';

interface Env {
  DB: D1Database;
  EMAIL_QUEUE: Queue;
  RESEND_API_KEY: string;
  ENVIRONMENT: string;
}

interface QueueMessage {
  type: string;
  [key: string]: unknown;
}

export default {
  async queue(batch: MessageBatch<QueueMessage>, env: Env): Promise<void> {
    console.log(`Processing ${batch.messages.length} messages from queue: ${batch.queue}`);

    for (const message of batch.messages) {
      try {
        const data = message.body;

        if (batch.queue === 'payment-webhooks') {
          await handlePaymentWebhook(data as unknown as Parameters<typeof handlePaymentWebhook>[0], env);
        } else if (batch.queue === 'email-notifications') {
          await handleEmailNotification(data as unknown as Parameters<typeof handleEmailNotification>[0], env);
        } else {
          console.warn(`Unknown queue: ${batch.queue}`);
        }

        // Acknowledge the message
        message.ack();
      } catch (error) {
        console.error(`Error processing message:`, error);
        // Retry the message
        message.retry();
      }
    }
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    // Health check endpoint
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not Found', { status: 404 });
  },
};
