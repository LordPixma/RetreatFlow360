/**
 * Webhook Management Routes
 *
 * Manages webhook subscriptions for event notifications:
 * - Create/update/delete webhooks
 * - View delivery logs
 * - Test webhook endpoints
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { ulid } from 'ulid';
import { createDb } from '@retreatflow360/database';
import { webhooks, webhookDeliveries } from '@retreatflow360/database/schema';
import type { Env, Variables } from '@retreatflow360/shared-types';

type AppEnv = { Bindings: Env; Variables: Variables };

const app = new Hono<AppEnv>();

// Available webhook event types
const WEBHOOK_EVENTS = [
  'event.created',
  'event.updated',
  'event.published',
  'event.cancelled',
  'booking.created',
  'booking.confirmed',
  'booking.cancelled',
  'payment.succeeded',
  'payment.failed',
  'payment.refunded',
] as const;

// Validation schemas
const createWebhookSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url(),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1),
  headers: z.record(z.string()).optional(),
  maxRetries: z.number().min(0).max(10).optional(),
});

const updateWebhookSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  url: z.string().url().optional(),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1).optional(),
  headers: z.record(z.string()).optional(),
  maxRetries: z.number().min(0).max(10).optional(),
  isActive: z.boolean().optional(),
});

/**
 * Generate webhook signing secret
 */
function generateSecret(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * List webhooks
 */
app.get('/', async (c) => {
  const user = c.get('user');
  const tenant = c.get('tenant');
  if (!user || !tenant) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  // Check if user is staff+
  if (!['global_admin', 'tenant_owner', 'tenant_admin', 'staff'].includes(user.role)) {
    return c.json({ error: 'Staff access required' }, 403);
  }

  const database = createDb(c.env.DB);

  const webhookList = await database
    .select({
      id: webhooks.id,
      name: webhooks.name,
      url: webhooks.url,
      events: webhooks.events,
      isActive: webhooks.isActive,
      maxRetries: webhooks.maxRetries,
      lastTriggeredAt: webhooks.lastTriggeredAt,
      successCount: webhooks.successCount,
      failureCount: webhooks.failureCount,
      createdAt: webhooks.createdAt,
      updatedAt: webhooks.updatedAt,
    })
    .from(webhooks)
    .where(eq(webhooks.tenantId, tenant.id))
    .orderBy(desc(webhooks.createdAt));

  return c.json({ webhooks: webhookList, availableEvents: WEBHOOK_EVENTS });
});

/**
 * Create webhook
 */
app.post('/', zValidator('json', createWebhookSchema), async (c) => {
  const user = c.get('user');
  const tenant = c.get('tenant');
  if (!user || !tenant) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  // Check if user is admin+
  if (!['global_admin', 'tenant_owner', 'tenant_admin'].includes(user.role)) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  const data = c.req.valid('json');
  const database = createDb(c.env.DB);
  const now = new Date();

  const secret = generateSecret();
  const id = ulid();

  await database.insert(webhooks).values({
    id,
    tenantId: tenant.id,
    createdBy: user.sub,
    name: data.name,
    url: data.url,
    secret,
    events: data.events,
    headers: data.headers || {},
    maxRetries: data.maxRetries ?? 3,
    isActive: true,
    successCount: 0,
    failureCount: 0,
    createdAt: now,
    updatedAt: now,
  });

  return c.json({
    webhook: {
      id,
      name: data.name,
      url: data.url,
      events: data.events,
      secret, // Only returned on creation
    },
    message: 'Webhook created. Save the secret - it will not be shown again.',
  }, 201);
});

/**
 * Get webhook details
 */
app.get('/:webhookId', async (c) => {
  const user = c.get('user');
  const tenant = c.get('tenant');
  if (!user || !tenant) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  if (!['global_admin', 'tenant_owner', 'tenant_admin', 'staff'].includes(user.role)) {
    return c.json({ error: 'Staff access required' }, 403);
  }

  const webhookId = c.req.param('webhookId');
  const database = createDb(c.env.DB);

  const [webhook] = await database
    .select({
      id: webhooks.id,
      name: webhooks.name,
      url: webhooks.url,
      events: webhooks.events,
      headers: webhooks.headers,
      isActive: webhooks.isActive,
      maxRetries: webhooks.maxRetries,
      lastTriggeredAt: webhooks.lastTriggeredAt,
      successCount: webhooks.successCount,
      failureCount: webhooks.failureCount,
      createdAt: webhooks.createdAt,
      updatedAt: webhooks.updatedAt,
    })
    .from(webhooks)
    .where(and(eq(webhooks.id, webhookId), eq(webhooks.tenantId, tenant.id)));

  if (!webhook) {
    return c.json({ error: 'Webhook not found' }, 404);
  }

  return c.json({ webhook });
});

/**
 * Update webhook
 */
app.patch('/:webhookId', zValidator('json', updateWebhookSchema), async (c) => {
  const user = c.get('user');
  const tenant = c.get('tenant');
  if (!user || !tenant) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  if (!['global_admin', 'tenant_owner', 'tenant_admin'].includes(user.role)) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  const webhookId = c.req.param('webhookId');
  const data = c.req.valid('json');
  const database = createDb(c.env.DB);

  // Check webhook exists
  const [existing] = await database
    .select({ id: webhooks.id })
    .from(webhooks)
    .where(and(eq(webhooks.id, webhookId), eq(webhooks.tenantId, tenant.id)));

  if (!existing) {
    return c.json({ error: 'Webhook not found' }, 404);
  }

  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (data.name !== undefined) updates.name = data.name;
  if (data.url !== undefined) updates.url = data.url;
  if (data.events !== undefined) updates.events = data.events;
  if (data.headers !== undefined) updates.headers = data.headers;
  if (data.maxRetries !== undefined) updates.maxRetries = data.maxRetries;
  if (data.isActive !== undefined) updates.isActive = data.isActive;

  await database.update(webhooks).set(updates).where(eq(webhooks.id, webhookId));

  return c.json({ message: 'Webhook updated' });
});

/**
 * Delete webhook
 */
app.delete('/:webhookId', async (c) => {
  const user = c.get('user');
  const tenant = c.get('tenant');
  if (!user || !tenant) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  if (!['global_admin', 'tenant_owner', 'tenant_admin'].includes(user.role)) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  const webhookId = c.req.param('webhookId');
  const database = createDb(c.env.DB);

  const result = await database
    .delete(webhooks)
    .where(and(eq(webhooks.id, webhookId), eq(webhooks.tenantId, tenant.id)));

  return c.json({ message: 'Webhook deleted' });
});

/**
 * Rotate webhook secret
 */
app.post('/:webhookId/rotate-secret', async (c) => {
  const user = c.get('user');
  const tenant = c.get('tenant');
  if (!user || !tenant) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  if (!['global_admin', 'tenant_owner', 'tenant_admin'].includes(user.role)) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  const webhookId = c.req.param('webhookId');
  const database = createDb(c.env.DB);

  // Check webhook exists
  const [existing] = await database
    .select({ id: webhooks.id })
    .from(webhooks)
    .where(and(eq(webhooks.id, webhookId), eq(webhooks.tenantId, tenant.id)));

  if (!existing) {
    return c.json({ error: 'Webhook not found' }, 404);
  }

  const newSecret = generateSecret();

  await database
    .update(webhooks)
    .set({ secret: newSecret, updatedAt: new Date() })
    .where(eq(webhooks.id, webhookId));

  return c.json({
    secret: newSecret,
    message: 'Secret rotated. Save the new secret - it will not be shown again.',
  });
});

/**
 * Test webhook
 */
app.post('/:webhookId/test', async (c) => {
  const user = c.get('user');
  const tenant = c.get('tenant');
  if (!user || !tenant) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  if (!['global_admin', 'tenant_owner', 'tenant_admin', 'staff'].includes(user.role)) {
    return c.json({ error: 'Staff access required' }, 403);
  }

  const webhookId = c.req.param('webhookId');
  const database = createDb(c.env.DB);

  const [webhook] = await database
    .select()
    .from(webhooks)
    .where(and(eq(webhooks.id, webhookId), eq(webhooks.tenantId, tenant.id)));

  if (!webhook) {
    return c.json({ error: 'Webhook not found' }, 404);
  }

  // Send test payload
  const testPayload = {
    id: ulid(),
    type: 'webhook.test',
    timestamp: new Date().toISOString(),
    data: {
      message: 'This is a test webhook delivery',
      tenantId: tenant.id,
    },
  };

  // Create signature
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(webhook.secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(JSON.stringify(testPayload))
  );
  const signatureHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const startTime = Date.now();
  let statusCode: number | undefined;
  let responseBody: string | undefined;
  let error: string | undefined;

  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': `sha256=${signatureHex}`,
        'X-Webhook-ID': webhook.id,
        'X-Webhook-Event': 'webhook.test',
        ...webhook.headers,
      },
      body: JSON.stringify(testPayload),
    });

    statusCode = response.status;
    responseBody = await response.text();
  } catch (err) {
    error = err instanceof Error ? err.message : 'Unknown error';
  }

  const duration = Date.now() - startTime;

  // Log the test delivery
  await database.insert(webhookDeliveries).values({
    id: ulid(),
    webhookId: webhook.id,
    tenantId: tenant.id,
    eventType: 'webhook.test',
    payload: testPayload,
    statusCode,
    responseBody: responseBody?.substring(0, 1000),
    duration,
    attempt: 1,
    status: statusCode && statusCode >= 200 && statusCode < 300 ? 'success' : 'failed',
    error,
    createdAt: new Date(),
  });

  return c.json({
    success: statusCode !== undefined && statusCode >= 200 && statusCode < 300,
    statusCode,
    duration,
    error,
  });
});

/**
 * Get webhook delivery logs
 */
app.get('/:webhookId/deliveries', async (c) => {
  const user = c.get('user');
  const tenant = c.get('tenant');
  if (!user || !tenant) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  if (!['global_admin', 'tenant_owner', 'tenant_admin', 'staff'].includes(user.role)) {
    return c.json({ error: 'Staff access required' }, 403);
  }

  const webhookId = c.req.param('webhookId');
  const page = parseInt(c.req.query('page') || '1');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
  const offset = (page - 1) * limit;

  const database = createDb(c.env.DB);

  // Verify webhook exists
  const [webhook] = await database
    .select({ id: webhooks.id })
    .from(webhooks)
    .where(and(eq(webhooks.id, webhookId), eq(webhooks.tenantId, tenant.id)));

  if (!webhook) {
    return c.json({ error: 'Webhook not found' }, 404);
  }

  const deliveries = await database
    .select({
      id: webhookDeliveries.id,
      eventType: webhookDeliveries.eventType,
      statusCode: webhookDeliveries.statusCode,
      duration: webhookDeliveries.duration,
      attempt: webhookDeliveries.attempt,
      status: webhookDeliveries.status,
      error: webhookDeliveries.error,
      createdAt: webhookDeliveries.createdAt,
    })
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.webhookId, webhookId))
    .orderBy(desc(webhookDeliveries.createdAt))
    .limit(limit)
    .offset(offset);

  return c.json({
    deliveries,
    pagination: {
      page,
      limit,
      hasMore: deliveries.length === limit,
    },
  });
});

/**
 * Get delivery details
 */
app.get('/:webhookId/deliveries/:deliveryId', async (c) => {
  const user = c.get('user');
  const tenant = c.get('tenant');
  if (!user || !tenant) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  if (!['global_admin', 'tenant_owner', 'tenant_admin', 'staff'].includes(user.role)) {
    return c.json({ error: 'Staff access required' }, 403);
  }

  const webhookId = c.req.param('webhookId');
  const deliveryId = c.req.param('deliveryId');
  const database = createDb(c.env.DB);

  const [delivery] = await database
    .select()
    .from(webhookDeliveries)
    .where(
      and(
        eq(webhookDeliveries.id, deliveryId),
        eq(webhookDeliveries.webhookId, webhookId),
        eq(webhookDeliveries.tenantId, tenant.id)
      )
    );

  if (!delivery) {
    return c.json({ error: 'Delivery not found' }, 404);
  }

  return c.json({ delivery });
});

/**
 * Retry a failed delivery
 */
app.post('/:webhookId/deliveries/:deliveryId/retry', async (c) => {
  const user = c.get('user');
  const tenant = c.get('tenant');
  if (!user || !tenant) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  if (!['global_admin', 'tenant_owner', 'tenant_admin'].includes(user.role)) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  const webhookId = c.req.param('webhookId');
  const deliveryId = c.req.param('deliveryId');
  const database = createDb(c.env.DB);

  // Get webhook and delivery
  const [webhook] = await database
    .select()
    .from(webhooks)
    .where(and(eq(webhooks.id, webhookId), eq(webhooks.tenantId, tenant.id)));

  if (!webhook) {
    return c.json({ error: 'Webhook not found' }, 404);
  }

  const [originalDelivery] = await database
    .select()
    .from(webhookDeliveries)
    .where(
      and(
        eq(webhookDeliveries.id, deliveryId),
        eq(webhookDeliveries.webhookId, webhookId)
      )
    );

  if (!originalDelivery) {
    return c.json({ error: 'Delivery not found' }, 404);
  }

  // Create signature
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(webhook.secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(JSON.stringify(originalDelivery.payload))
  );
  const signatureHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const startTime = Date.now();
  let statusCode: number | undefined;
  let responseBody: string | undefined;
  let error: string | undefined;

  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': `sha256=${signatureHex}`,
        'X-Webhook-ID': webhook.id,
        'X-Webhook-Event': originalDelivery.eventType,
        ...webhook.headers,
      },
      body: JSON.stringify(originalDelivery.payload),
    });

    statusCode = response.status;
    responseBody = await response.text();
  } catch (err) {
    error = err instanceof Error ? err.message : 'Unknown error';
  }

  const duration = Date.now() - startTime;
  const success = statusCode !== undefined && statusCode >= 200 && statusCode < 300;

  // Log retry delivery
  await database.insert(webhookDeliveries).values({
    id: ulid(),
    webhookId: webhook.id,
    tenantId: tenant.id,
    eventType: originalDelivery.eventType,
    payload: originalDelivery.payload,
    statusCode,
    responseBody: responseBody?.substring(0, 1000),
    duration,
    attempt: originalDelivery.attempt + 1,
    status: success ? 'success' : 'failed',
    error,
    createdAt: new Date(),
  });

  // Update webhook stats
  if (success) {
    await database
      .update(webhooks)
      .set({
        successCount: (webhook.successCount || 0) + 1,
        lastTriggeredAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(webhooks.id, webhook.id));
  } else {
    await database
      .update(webhooks)
      .set({
        failureCount: (webhook.failureCount || 0) + 1,
        lastTriggeredAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(webhooks.id, webhook.id));
  }

  return c.json({
    success,
    statusCode,
    duration,
    error,
  });
});

export default app;
