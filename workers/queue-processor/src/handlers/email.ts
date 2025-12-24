/**
 * Email Handler
 *
 * Processes email notifications from the queue
 */

import { createDb } from '@retreatflow360/database';
import { bookings, users, events, payments, tenants } from '@retreatflow360/database/schema';
import { eq } from 'drizzle-orm';

interface EmailMessage {
  type: string;
  bookingId?: string;
  paymentId?: string;
  tenantId: string;
  [key: string]: unknown;
}

interface Env {
  DB: D1Database;
  RESEND_API_KEY: string;
}

interface EmailData {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

async function sendEmail(env: Env, data: EmailData): Promise<boolean> {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: data.from || 'RetreatFlow360 <noreply@retreatflow360.com>',
        to: [data.to],
        subject: data.subject,
        html: data.html,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Failed to send email:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Email send error:', error);
    return false;
  }
}

export async function handleEmailNotification(
  message: EmailMessage,
  env: Env
): Promise<void> {
  const database = createDb(env.DB);

  // Get tenant info for branding
  const [tenant] = await database
    .select()
    .from(tenants)
    .where(eq(tenants.id, message.tenantId));

  if (!tenant) {
    console.error(`Tenant not found: ${message.tenantId}`);
    return;
  }

  switch (message.type) {
    case 'booking_confirmation': {
      if (!message.bookingId) return;

      const [booking] = await database
        .select()
        .from(bookings)
        .where(eq(bookings.id, message.bookingId));

      if (!booking) return;

      const [user] = await database
        .select()
        .from(users)
        .where(eq(users.id, booking.userId));

      const [event] = await database
        .select()
        .from(events)
        .where(eq(events.id, booking.eventId));

      if (!user || !event) return;

      await sendEmail(env, {
        to: user.email,
        subject: `Booking Confirmed - ${event.title}`,
        html: `
          <h1>Your booking is confirmed!</h1>
          <p>Thank you for booking ${event.title}.</p>
          <p>Booking ID: ${booking.id}</p>
          <p>If you have any questions, please contact us.</p>
          <p>Best regards,<br>${tenant.name}</p>
        `,
      });
      break;
    }

    case 'payment_confirmation': {
      if (!message.paymentId) return;

      const [payment] = await database
        .select()
        .from(payments)
        .where(eq(payments.id, message.paymentId));

      if (!payment) return;

      const [booking] = await database
        .select()
        .from(bookings)
        .where(eq(bookings.id, payment.bookingId));

      if (!booking) return;

      const [user] = await database
        .select()
        .from(users)
        .where(eq(users.id, booking.userId));

      if (!user) return;

      await sendEmail(env, {
        to: user.email,
        subject: 'Payment Received',
        html: `
          <h1>Payment Received</h1>
          <p>We've received your payment of ${payment.amount} ${payment.currency}.</p>
          <p>Payment ID: ${payment.id}</p>
          <p>Thank you for your payment!</p>
          <p>Best regards,<br>${tenant.name}</p>
        `,
      });
      break;
    }

    case 'payment_failed': {
      if (!message.bookingId) return;

      const [booking] = await database
        .select()
        .from(bookings)
        .where(eq(bookings.id, message.bookingId));

      if (!booking) return;

      const [user] = await database
        .select()
        .from(users)
        .where(eq(users.id, booking.userId));

      if (!user) return;

      await sendEmail(env, {
        to: user.email,
        subject: 'Payment Failed',
        html: `
          <h1>Payment Failed</h1>
          <p>Unfortunately, your payment could not be processed.</p>
          <p>Please try again or contact us for assistance.</p>
          <p>Best regards,<br>${tenant.name}</p>
        `,
      });
      break;
    }

    case 'refund_confirmation': {
      if (!message.paymentId) return;

      const [payment] = await database
        .select()
        .from(payments)
        .where(eq(payments.id, message.paymentId));

      if (!payment) return;

      const [booking] = await database
        .select()
        .from(bookings)
        .where(eq(bookings.id, payment.bookingId));

      if (!booking) return;

      const [user] = await database
        .select()
        .from(users)
        .where(eq(users.id, booking.userId));

      if (!user) return;

      await sendEmail(env, {
        to: user.email,
        subject: 'Refund Processed',
        html: `
          <h1>Refund Processed</h1>
          <p>Your refund of ${payment.amount} ${payment.currency} has been processed.</p>
          <p>The funds should appear in your account within 5-10 business days.</p>
          <p>Best regards,<br>${tenant.name}</p>
        `,
      });
      break;
    }

    default:
      console.log(`Unknown email type: ${message.type}`);
  }
}
