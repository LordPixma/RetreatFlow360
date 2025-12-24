/**
 * API Key Management Routes
 *
 * Manages API keys for public API access:
 * - Create/revoke API keys
 * - View key usage
 * - Manage scopes
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { ulid } from 'ulid';
import { createDb } from '@retreatflow360/database';
import { apiKeys } from '@retreatflow360/database/schema';
import type { Env, Variables } from '@retreatflow360/shared-types';

type AppEnv = { Bindings: Env; Variables: Variables };

const app = new Hono<AppEnv>();

// Available scopes
const API_SCOPES = [
  'events:read',
  'events:write',
  'venues:read',
  'venues:write',
  'bookings:read',
  'bookings:write',
  'sessions:read',
  'sessions:write',
] as const;

// Validation schemas
const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.enum(API_SCOPES)).min(1),
  expiresIn: z.number().min(1).max(365).optional(), // Days until expiration
  rateLimit: z.number().min(100).max(10000).optional(),
});

const updateApiKeySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  scopes: z.array(z.enum(API_SCOPES)).min(1).optional(),
  rateLimit: z.number().min(100).max(10000).optional(),
});

/**
 * Generate API key with prefix
 */
function generateApiKey(): { key: string; prefix: string } {
  const prefix = 'rf360_';
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  const random = Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return {
    key: `${prefix}${random}`,
    prefix: prefix + random.substring(0, 2), // First 8 chars for identification
  };
}

/**
 * Hash API key for storage
 */
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * List API keys
 */
app.get('/', async (c) => {
  const user = c.get('user');
  const tenant = c.get('tenant');
  if (!user || !tenant) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  // Check if user is admin+
  if (!['global_admin', 'tenant_owner', 'tenant_admin'].includes(user.role)) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  const database = createDb(c.env.DB);

  const keys = await database
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      scopes: apiKeys.scopes,
      rateLimit: apiKeys.rateLimit,
      expiresAt: apiKeys.expiresAt,
      lastUsedAt: apiKeys.lastUsedAt,
      isActive: apiKeys.isActive,
      createdAt: apiKeys.createdAt,
      revokedAt: apiKeys.revokedAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.tenantId, tenant.id))
    .orderBy(desc(apiKeys.createdAt));

  return c.json({ apiKeys: keys, availableScopes: API_SCOPES });
});

/**
 * Create API key
 */
app.post('/', zValidator('json', createApiKeySchema), async (c) => {
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

  // Generate key
  const { key, prefix } = generateApiKey();
  const keyHash = await hashApiKey(key);

  // Calculate expiration
  let expiresAt: Date | undefined;
  if (data.expiresIn) {
    expiresAt = new Date(now.getTime() + data.expiresIn * 24 * 60 * 60 * 1000);
  }

  const id = ulid();

  await database.insert(apiKeys).values({
    id,
    tenantId: tenant.id,
    createdBy: user.sub,
    name: data.name,
    keyPrefix: prefix,
    keyHash,
    scopes: data.scopes,
    rateLimit: data.rateLimit ?? 1000,
    expiresAt,
    isActive: true,
    createdAt: now,
  });

  return c.json(
    {
      apiKey: {
        id,
        name: data.name,
        key, // Only returned on creation
        keyPrefix: prefix,
        scopes: data.scopes,
        expiresAt,
      },
      message: 'API key created. Save the key - it will not be shown again.',
    },
    201
  );
});

/**
 * Get API key details
 */
app.get('/:keyId', async (c) => {
  const user = c.get('user');
  const tenant = c.get('tenant');
  if (!user || !tenant) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  if (!['global_admin', 'tenant_owner', 'tenant_admin'].includes(user.role)) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  const keyId = c.req.param('keyId');
  const database = createDb(c.env.DB);

  const [apiKey] = await database
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      scopes: apiKeys.scopes,
      rateLimit: apiKeys.rateLimit,
      expiresAt: apiKeys.expiresAt,
      lastUsedAt: apiKeys.lastUsedAt,
      isActive: apiKeys.isActive,
      createdAt: apiKeys.createdAt,
      revokedAt: apiKeys.revokedAt,
    })
    .from(apiKeys)
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.tenantId, tenant.id)));

  if (!apiKey) {
    return c.json({ error: 'API key not found' }, 404);
  }

  return c.json({ apiKey });
});

/**
 * Update API key
 */
app.patch('/:keyId', zValidator('json', updateApiKeySchema), async (c) => {
  const user = c.get('user');
  const tenant = c.get('tenant');
  if (!user || !tenant) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  if (!['global_admin', 'tenant_owner', 'tenant_admin'].includes(user.role)) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  const keyId = c.req.param('keyId');
  const data = c.req.valid('json');
  const database = createDb(c.env.DB);

  // Check key exists
  const [existing] = await database
    .select({ id: apiKeys.id, isActive: apiKeys.isActive })
    .from(apiKeys)
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.tenantId, tenant.id)));

  if (!existing) {
    return c.json({ error: 'API key not found' }, 404);
  }

  if (!existing.isActive) {
    return c.json({ error: 'Cannot update a revoked API key' }, 400);
  }

  const updates: Record<string, unknown> = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.scopes !== undefined) updates.scopes = data.scopes;
  if (data.rateLimit !== undefined) updates.rateLimit = data.rateLimit;

  if (Object.keys(updates).length === 0) {
    return c.json({ error: 'No updates provided' }, 400);
  }

  await database.update(apiKeys).set(updates).where(eq(apiKeys.id, keyId));

  return c.json({ message: 'API key updated' });
});

/**
 * Revoke API key
 */
app.post('/:keyId/revoke', async (c) => {
  const user = c.get('user');
  const tenant = c.get('tenant');
  if (!user || !tenant) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  if (!['global_admin', 'tenant_owner', 'tenant_admin'].includes(user.role)) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  const keyId = c.req.param('keyId');
  const database = createDb(c.env.DB);

  const [existing] = await database
    .select({ id: apiKeys.id })
    .from(apiKeys)
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.tenantId, tenant.id)));

  if (!existing) {
    return c.json({ error: 'API key not found' }, 404);
  }

  await database
    .update(apiKeys)
    .set({
      isActive: false,
      revokedAt: new Date(),
    })
    .where(eq(apiKeys.id, keyId));

  return c.json({ message: 'API key revoked' });
});

/**
 * Delete API key permanently
 */
app.delete('/:keyId', async (c) => {
  const user = c.get('user');
  const tenant = c.get('tenant');
  if (!user || !tenant) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  if (!['global_admin', 'tenant_owner'].includes(user.role)) {
    return c.json({ error: 'Owner access required' }, 403);
  }

  const keyId = c.req.param('keyId');
  const database = createDb(c.env.DB);

  await database
    .delete(apiKeys)
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.tenantId, tenant.id)));

  return c.json({ message: 'API key deleted' });
});

/**
 * Get API key usage stats
 */
app.get('/:keyId/usage', async (c) => {
  const user = c.get('user');
  const tenant = c.get('tenant');
  if (!user || !tenant) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  if (!['global_admin', 'tenant_owner', 'tenant_admin'].includes(user.role)) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  const keyId = c.req.param('keyId');
  const database = createDb(c.env.DB);

  const [apiKey] = await database
    .select({
      id: apiKeys.id,
      rateLimit: apiKeys.rateLimit,
      lastUsedAt: apiKeys.lastUsedAt,
    })
    .from(apiKeys)
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.tenantId, tenant.id)));

  if (!apiKey) {
    return c.json({ error: 'API key not found' }, 404);
  }

  // Get current rate limit usage from KV
  const rateLimitKey = `api-rate:${keyId}`;
  const currentUsage = (await c.env.KV.get<number>(rateLimitKey, 'json')) || 0;

  return c.json({
    usage: {
      currentHour: currentUsage,
      limit: apiKey.rateLimit,
      remaining: Math.max(0, (apiKey.rateLimit || 1000) - currentUsage),
      lastUsedAt: apiKey.lastUsedAt,
    },
  });
});

export default app;
