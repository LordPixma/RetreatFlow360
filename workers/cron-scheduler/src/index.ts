/**
 * Cron Scheduler Worker
 *
 * Handles scheduled tasks:
 * - Event reminder emails
 * - Upcoming payment reminders
 * - Event status updates
 * - Cleanup tasks
 */

import { createDb } from '@retreatflow360/database';
import { events, bookings, users, payments, scheduledNotifications } from '@retreatflow360/database/schema';
import { eq, and, gte, lte, isNull, lt } from 'drizzle-orm';

interface Env {
  DB: D1Database;
  KV: KVNamespace;
  NOTIFICATION_QUEUE: Queue;
  ENVIRONMENT: string;
}

interface ScheduledEvent {
  cron: string;
  scheduledTime: number;
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const database = createDb(env.DB);
    const now = new Date();

    console.log(`[Cron] Running scheduled tasks at ${now.toISOString()}`);

    // Run all scheduled tasks
    ctx.waitUntil(
      Promise.all([
        sendEventReminders(database, env, now),
        sendPaymentReminders(database, env, now),
        updateEventStatuses(database, now),
        processScheduledNotifications(database, env, now),
        cleanupExpiredData(database, env, now),
      ])
    );
  },
};

/**
 * Send event reminder emails
 * Sends reminders 7 days and 1 day before events
 */
async function sendEventReminders(
  database: ReturnType<typeof createDb>,
  env: Env,
  now: Date
): Promise<void> {
  console.log('[Cron] Checking for event reminders...');

  // Get events happening in 7 days
  const sevenDaysFromNow = new Date(now);
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
  sevenDaysFromNow.setHours(0, 0, 0, 0);

  const sevenDaysEnd = new Date(sevenDaysFromNow);
  sevenDaysEnd.setHours(23, 59, 59, 999);

  // Get events happening tomorrow
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const tomorrowEnd = new Date(tomorrow);
  tomorrowEnd.setHours(23, 59, 59, 999);

  // Find events starting in 7 days
  const eventsIn7Days = await database
    .select({
      id: events.id,
      title: events.title,
      startDate: events.startDate,
      tenantId: events.tenantId,
    })
    .from(events)
    .where(
      and(
        gte(events.startDate, sevenDaysFromNow),
        lte(events.startDate, sevenDaysEnd),
        eq(events.status, 'published'),
        isNull(events.deletedAt)
      )
    );

  // Find events starting tomorrow
  const eventsTomorrow = await database
    .select({
      id: events.id,
      title: events.title,
      startDate: events.startDate,
      tenantId: events.tenantId,
    })
    .from(events)
    .where(
      and(
        gte(events.startDate, tomorrow),
        lte(events.startDate, tomorrowEnd),
        eq(events.status, 'published'),
        isNull(events.deletedAt)
      )
    );

  // Process 7-day reminders
  for (const event of eventsIn7Days) {
    const reminderKey = `reminder:7day:${event.id}`;
    const alreadySent = await env.KV.get(reminderKey);

    if (!alreadySent) {
      await sendEventReminderEmails(database, env, event, '7 days');
      await env.KV.put(reminderKey, 'sent', { expirationTtl: 60 * 60 * 24 * 8 }); // 8 days
    }
  }

  // Process 1-day reminders
  for (const event of eventsTomorrow) {
    const reminderKey = `reminder:1day:${event.id}`;
    const alreadySent = await env.KV.get(reminderKey);

    if (!alreadySent) {
      await sendEventReminderEmails(database, env, event, '1 day');
      await env.KV.put(reminderKey, 'sent', { expirationTtl: 60 * 60 * 24 * 2 }); // 2 days
    }
  }

  console.log(
    `[Cron] Processed ${eventsIn7Days.length} 7-day reminders, ${eventsTomorrow.length} 1-day reminders`
  );
}

/**
 * Send reminder emails to all confirmed attendees of an event
 */
async function sendEventReminderEmails(
  database: ReturnType<typeof createDb>,
  env: Env,
  event: { id: string; title: string; startDate: Date; tenantId: string },
  timeframe: string
): Promise<void> {
  // Get all confirmed bookings for this event
  const confirmedBookings = await database
    .select({
      bookingId: bookings.id,
      userId: bookings.userId,
    })
    .from(bookings)
    .where(and(eq(bookings.eventId, event.id), eq(bookings.status, 'confirmed')));

  for (const booking of confirmedBookings) {
    // Queue reminder email
    await env.NOTIFICATION_QUEUE.send({
      type: 'event_reminder',
      bookingId: booking.bookingId,
      eventId: event.id,
      eventTitle: event.title,
      eventDate: event.startDate.toISOString(),
      timeframe,
      tenantId: event.tenantId,
    });
  }
}

/**
 * Send payment reminders for pending payments
 */
async function sendPaymentReminders(
  database: ReturnType<typeof createDb>,
  env: Env,
  now: Date
): Promise<void> {
  console.log('[Cron] Checking for payment reminders...');

  // Find pending payments older than 24 hours
  const oneDayAgo = new Date(now);
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  const pendingPayments = await database
    .select({
      paymentId: payments.id,
      bookingId: payments.bookingId,
      amount: payments.amount,
      currency: payments.currency,
      tenantId: payments.tenantId,
      createdAt: payments.createdAt,
    })
    .from(payments)
    .where(and(eq(payments.status, 'pending'), lt(payments.createdAt, oneDayAgo)));

  for (const payment of pendingPayments) {
    const reminderKey = `payment-reminder:${payment.paymentId}`;
    const alreadySent = await env.KV.get(reminderKey);

    if (!alreadySent) {
      // Get booking details
      const [booking] = await database
        .select({ userId: bookings.userId })
        .from(bookings)
        .where(eq(bookings.id, payment.bookingId));

      if (booking) {
        await env.NOTIFICATION_QUEUE.send({
          type: 'payment_reminder',
          paymentId: payment.paymentId,
          bookingId: payment.bookingId,
          amount: payment.amount,
          currency: payment.currency,
          tenantId: payment.tenantId,
        });

        await env.KV.put(reminderKey, 'sent', { expirationTtl: 60 * 60 * 24 * 3 }); // 3 days
      }
    }
  }

  console.log(`[Cron] Processed ${pendingPayments.length} payment reminders`);
}

/**
 * Update event statuses based on dates
 */
async function updateEventStatuses(
  database: ReturnType<typeof createDb>,
  now: Date
): Promise<void> {
  console.log('[Cron] Updating event statuses...');

  // Mark past events as completed
  const completedCount = await database
    .update(events)
    .set({ status: 'completed', updatedAt: now })
    .where(
      and(
        lt(events.endDate, now),
        eq(events.status, 'published'),
        isNull(events.deletedAt)
      )
    );

  console.log(`[Cron] Updated event statuses`);
}

/**
 * Process scheduled notifications
 */
async function processScheduledNotifications(
  database: ReturnType<typeof createDb>,
  env: Env,
  now: Date
): Promise<void> {
  console.log('[Cron] Processing scheduled notifications...');

  // Get notifications scheduled for now or earlier that are still scheduled
  const pendingNotifications = await database
    .select()
    .from(scheduledNotifications)
    .where(
      and(
        lte(scheduledNotifications.scheduledFor, now),
        eq(scheduledNotifications.status, 'scheduled')
      )
    );

  for (const notification of pendingNotifications) {
    try {
      // Mark as processing
      await database
        .update(scheduledNotifications)
        .set({ status: 'processing' })
        .where(eq(scheduledNotifications.id, notification.id));

      // Send to notification queue - metadata contains the details
      await env.NOTIFICATION_QUEUE.send({
        type: notification.type,
        tenantId: notification.tenantId,
        metadata: notification.metadata,
      });

      // Mark as completed
      await database
        .update(scheduledNotifications)
        .set({ status: 'completed', processedAt: now })
        .where(eq(scheduledNotifications.id, notification.id));
    } catch (error) {
      console.error(`[Cron] Failed to process notification ${notification.id}:`, error);

      // Mark as failed
      await database
        .update(scheduledNotifications)
        .set({ status: 'failed' })
        .where(eq(scheduledNotifications.id, notification.id));
    }
  }

  console.log(`[Cron] Processed ${pendingNotifications.length} scheduled notifications`);
}

/**
 * Cleanup expired data
 */
async function cleanupExpiredData(
  database: ReturnType<typeof createDb>,
  env: Env,
  now: Date
): Promise<void> {
  console.log('[Cron] Running cleanup tasks...');

  // Clean up old completed/failed notifications (older than 30 days)
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  await database
    .delete(scheduledNotifications)
    .where(
      and(
        eq(scheduledNotifications.status, 'completed'),
        lt(scheduledNotifications.processedAt, thirtyDaysAgo)
      )
    );

  console.log('[Cron] Cleanup complete');
}
