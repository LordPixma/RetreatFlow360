/**
 * Notifications API Routes
 *
 * Handles notification management and preferences
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and, desc, isNull } from 'drizzle-orm';
import { ulid } from 'ulid';
import { createDb } from '@retreatflow360/database';
import { users, notifications, emailTemplates } from '@retreatflow360/database/schema';
import type { Env, Variables } from '@retreatflow360/shared-types';

type AppEnv = { Bindings: Env; Variables: Variables };

const app = new Hono<AppEnv>();

// Validation schemas
const updatePreferencesSchema = z.object({
  email: z
    .object({
      bookingConfirmation: z.boolean().optional(),
      paymentReceipt: z.boolean().optional(),
      eventReminders: z.boolean().optional(),
      eventUpdates: z.boolean().optional(),
      marketing: z.boolean().optional(),
    })
    .optional(),
  reminderDaysBefore: z.array(z.number().min(0).max(30)).optional(),
});

const listNotificationsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  type: z
    .enum([
      'booking_confirmation',
      'payment_receipt',
      'payment_failed',
      'refund_confirmation',
      'event_reminder',
      'event_update',
      'event_cancelled',
      'welcome',
      'password_reset',
      'general',
    ])
    .optional(),
  status: z.enum(['pending', 'sent', 'delivered', 'failed', 'read']).optional(),
  unreadOnly: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
});

const createTemplateSchema = z.object({
  type: z.enum([
    'booking_confirmation',
    'payment_receipt',
    'payment_failed',
    'refund_confirmation',
    'event_reminder',
    'event_update',
    'event_cancelled',
    'welcome',
    'password_reset',
  ]),
  name: z.string().min(1).max(100),
  subject: z.string().min(1).max(200),
  htmlContent: z.string().min(1),
  variables: z.array(z.string()).optional(),
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  subject: z.string().min(1).max(200).optional(),
  htmlContent: z.string().min(1).optional(),
  variables: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

/**
 * Get current user's notification preferences
 */
app.get('/preferences', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const database = createDb(c.env.DB);
  const [userRecord] = await database
    .select({ notificationPreferences: users.notificationPreferences })
    .from(users)
    .where(eq(users.id, user.sub));

  if (!userRecord) {
    return c.json({ error: 'User not found' }, 404);
  }

  const defaultPreferences = {
    email: {
      bookingConfirmation: true,
      paymentReceipt: true,
      eventReminders: true,
      eventUpdates: true,
      marketing: false,
    },
    reminderDaysBefore: [7, 1],
  };

  return c.json({
    preferences: userRecord.notificationPreferences || defaultPreferences,
  });
});

/**
 * Update current user's notification preferences
 */
app.patch(
  '/preferences',
  zValidator('json', updatePreferencesSchema),
  async (c) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    const updates = c.req.valid('json');
    const database = createDb(c.env.DB);

    // Get current preferences
    const [userRecord] = await database
      .select({ notificationPreferences: users.notificationPreferences })
      .from(users)
      .where(eq(users.id, user.sub));

    if (!userRecord) {
      return c.json({ error: 'User not found' }, 404);
    }

    const defaultPrefs = {
      email: {
        bookingConfirmation: true,
        paymentReceipt: true,
        eventReminders: true,
        eventUpdates: true,
        marketing: false,
      },
      reminderDaysBefore: [7, 1],
    };

    const currentPrefs = (userRecord.notificationPreferences as typeof defaultPrefs) || defaultPrefs;

    // Merge updates with explicit type
    const newPreferences: {
      email: {
        bookingConfirmation: boolean;
        paymentReceipt: boolean;
        eventReminders: boolean;
        eventUpdates: boolean;
        marketing: boolean;
      };
      reminderDaysBefore: number[];
    } = {
      email: {
        bookingConfirmation: updates.email?.bookingConfirmation ?? currentPrefs.email.bookingConfirmation,
        paymentReceipt: updates.email?.paymentReceipt ?? currentPrefs.email.paymentReceipt,
        eventReminders: updates.email?.eventReminders ?? currentPrefs.email.eventReminders,
        eventUpdates: updates.email?.eventUpdates ?? currentPrefs.email.eventUpdates,
        marketing: updates.email?.marketing ?? currentPrefs.email.marketing,
      },
      reminderDaysBefore: updates.reminderDaysBefore || currentPrefs.reminderDaysBefore,
    };

    await database
      .update(users)
      .set({
        notificationPreferences: newPreferences,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.sub));

    return c.json({ success: true, preferences: newPreferences });
  }
);

/**
 * List user's notifications
 */
app.get('/', zValidator('query', listNotificationsSchema), async (c) => {
  const user = c.get('user');
  const tenant = c.get('tenant');
  if (!user || !tenant) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const { page, limit, type, status, unreadOnly } = c.req.valid('query');
  const database = createDb(c.env.DB);
  const offset = (page - 1) * limit;

  const conditions = [
    eq(notifications.userId, user.sub),
    eq(notifications.tenantId, tenant.id),
  ];

  if (type) {
    conditions.push(eq(notifications.type, type));
  }

  if (status) {
    conditions.push(eq(notifications.status, status));
  }

  if (unreadOnly) {
    conditions.push(isNull(notifications.readAt));
  }

  const notificationList = await database
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .offset(offset);

  // Get unread count
  const unreadResult = await database
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, user.sub),
        eq(notifications.tenantId, tenant.id),
        isNull(notifications.readAt)
      )
    );

  return c.json({
    notifications: notificationList,
    unreadCount: unreadResult.length,
    meta: { page, limit },
  });
});

/**
 * Mark notification as read
 */
app.patch('/:id/read', async (c) => {
  const user = c.get('user');
  const tenant = c.get('tenant');
  if (!user || !tenant) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const notificationId = c.req.param('id');
  const database = createDb(c.env.DB);

  const [notification] = await database
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, user.sub),
        eq(notifications.tenantId, tenant.id)
      )
    );

  if (!notification) {
    return c.json({ error: 'Notification not found' }, 404);
  }

  await database
    .update(notifications)
    .set({
      readAt: new Date(),
      status: 'read',
    })
    .where(eq(notifications.id, notificationId));

  return c.json({ success: true });
});

/**
 * Mark all notifications as read
 */
app.post('/mark-all-read', async (c) => {
  const user = c.get('user');
  const tenant = c.get('tenant');
  if (!user || !tenant) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const database = createDb(c.env.DB);

  await database
    .update(notifications)
    .set({
      readAt: new Date(),
      status: 'read',
    })
    .where(
      and(
        eq(notifications.userId, user.sub),
        eq(notifications.tenantId, tenant.id),
        isNull(notifications.readAt)
      )
    );

  return c.json({ success: true });
});

/**
 * Delete a notification
 */
app.delete('/:id', async (c) => {
  const user = c.get('user');
  const tenant = c.get('tenant');
  if (!user || !tenant) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const notificationId = c.req.param('id');
  const database = createDb(c.env.DB);

  const [notification] = await database
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, user.sub),
        eq(notifications.tenantId, tenant.id)
      )
    );

  if (!notification) {
    return c.json({ error: 'Notification not found' }, 404);
  }

  await database.delete(notifications).where(eq(notifications.id, notificationId));

  return c.json({ success: true });
});

// --- Email Templates (Staff only) ---

/**
 * List email templates for tenant
 */
app.get('/templates', async (c) => {
  const user = c.get('user');
  const tenant = c.get('tenant');
  if (!user || !tenant) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  // Check if user is staff
  if (!['global_admin', 'tenant_owner', 'tenant_admin'].includes(user.role)) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  const database = createDb(c.env.DB);

  const templates = await database
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.tenantId, tenant.id))
    .orderBy(emailTemplates.type);

  return c.json({ templates });
});

/**
 * Get single email template
 */
app.get('/templates/:id', async (c) => {
  const user = c.get('user');
  const tenant = c.get('tenant');
  if (!user || !tenant) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  if (!['global_admin', 'tenant_owner', 'tenant_admin'].includes(user.role)) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  const templateId = c.req.param('id');
  const database = createDb(c.env.DB);

  const [template] = await database
    .select()
    .from(emailTemplates)
    .where(
      and(eq(emailTemplates.id, templateId), eq(emailTemplates.tenantId, tenant.id))
    );

  if (!template) {
    return c.json({ error: 'Template not found' }, 404);
  }

  return c.json({ template });
});

/**
 * Create email template
 */
app.post('/templates', zValidator('json', createTemplateSchema), async (c) => {
  const user = c.get('user');
  const tenant = c.get('tenant');
  if (!user || !tenant) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  if (!['global_admin', 'tenant_owner', 'tenant_admin'].includes(user.role)) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  const data = c.req.valid('json');
  const database = createDb(c.env.DB);
  const now = new Date();

  const templateId = ulid();
  await database.insert(emailTemplates).values({
    id: templateId,
    tenantId: tenant.id,
    type: data.type,
    name: data.name,
    subject: data.subject,
    htmlContent: data.htmlContent,
    variables: data.variables || [],
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  const [template] = await database
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.id, templateId));

  return c.json({ template }, 201);
});

/**
 * Update email template
 */
app.patch(
  '/templates/:id',
  zValidator('json', updateTemplateSchema),
  async (c) => {
    const user = c.get('user');
    const tenant = c.get('tenant');
    if (!user || !tenant) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    if (!['global_admin', 'tenant_owner', 'tenant_admin'].includes(user.role)) {
      return c.json({ error: 'Admin access required' }, 403);
    }

    const templateId = c.req.param('id');
    const updates = c.req.valid('json');
    const database = createDb(c.env.DB);

    const [template] = await database
      .select()
      .from(emailTemplates)
      .where(
        and(eq(emailTemplates.id, templateId), eq(emailTemplates.tenantId, tenant.id))
      );

    if (!template) {
      return c.json({ error: 'Template not found' }, 404);
    }

    await database
      .update(emailTemplates)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(emailTemplates.id, templateId));

    const [updatedTemplate] = await database
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.id, templateId));

    return c.json({ template: updatedTemplate });
  }
);

/**
 * Delete email template
 */
app.delete('/templates/:id', async (c) => {
  const user = c.get('user');
  const tenant = c.get('tenant');
  if (!user || !tenant) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  if (!['global_admin', 'tenant_owner', 'tenant_admin'].includes(user.role)) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  const templateId = c.req.param('id');
  const database = createDb(c.env.DB);

  const [template] = await database
    .select()
    .from(emailTemplates)
    .where(
      and(eq(emailTemplates.id, templateId), eq(emailTemplates.tenantId, tenant.id))
    );

  if (!template) {
    return c.json({ error: 'Template not found' }, 404);
  }

  await database.delete(emailTemplates).where(eq(emailTemplates.id, templateId));

  return c.json({ success: true });
});

export default app;
