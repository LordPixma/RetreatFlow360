/**
 * Admin API Routes
 *
 * Platform administration for global admins:
 * - Tenant management
 * - Subscription management
 * - Feature flags
 * - Platform analytics
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, desc, sql, count, sum, and, gte, lte, isNull } from 'drizzle-orm';
import { ulid } from 'ulid';
import { createDb } from '@retreatflow360/database';
import {
  tenants,
  users,
  events,
  bookings,
  payments,
  userTenantMemberships,
} from '@retreatflow360/database/schema';
import type { Env, Variables } from '@retreatflow360/shared-types';

type AppEnv = { Bindings: Env; Variables: Variables };

const app = new Hono<AppEnv>();

// Middleware to check global admin access
app.use('*', async (c, next) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  if (user.role !== 'global_admin') {
    return c.json({ error: 'Global admin access required' }, 403);
  }

  return next();
});

// Validation schemas
const createTenantSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  customDomain: z.string().optional(),
  subscriptionTier: z.enum(['free', 'starter', 'professional', 'enterprise']).default('free'),
  ownerEmail: z.string().email(),
  ownerName: z.string().min(1),
});

const updateTenantSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  customDomain: z.string().nullable().optional(),
  subscriptionTier: z.enum(['free', 'starter', 'professional', 'enterprise']).optional(),
  featureFlags: z.record(z.boolean()).optional(),
});

const listTenantsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  tier: z.enum(['free', 'starter', 'professional', 'enterprise']).optional(),
  search: z.string().optional(),
});

const analyticsQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  tenantId: z.string().optional(),
});

/**
 * List all tenants
 */
app.get('/tenants', zValidator('query', listTenantsSchema), async (c) => {
  const { page, limit, tier, search } = c.req.valid('query');
  const database = createDb(c.env.DB);
  const offset = (page - 1) * limit;

  // Build base query
  const query = database
    .select({
      id: tenants.id,
      name: tenants.name,
      slug: tenants.slug,
      customDomain: tenants.customDomain,
      subscriptionTier: tenants.subscriptionTier,
      createdAt: tenants.createdAt,
    })
    .from(tenants)
    .where(isNull(tenants.deletedAt))
    .orderBy(desc(tenants.createdAt))
    .limit(limit)
    .offset(offset);

  // Note: D1 doesn't support dynamic WHERE clauses well,
  // so we'll filter in application code for now
  const allTenants = await query;

  // Apply filters
  let filtered = allTenants;
  if (tier) {
    filtered = filtered.filter((t) => t.subscriptionTier === tier);
  }
  if (search) {
    const searchLower = search.toLowerCase();
    filtered = filtered.filter(
      (t) =>
        t.name.toLowerCase().includes(searchLower) ||
        t.slug.toLowerCase().includes(searchLower)
    );
  }

  // Get total count
  const countResult = await database
    .select({ count: sql<number>`count(*)` })
    .from(tenants)
    .where(isNull(tenants.deletedAt));

  return c.json({
    tenants: filtered,
    meta: {
      page,
      limit,
      total: countResult[0]?.count || 0,
    },
  });
});

/**
 * Get single tenant with stats
 */
app.get('/tenants/:id', async (c) => {
  const tenantId = c.req.param('id');
  const database = createDb(c.env.DB);

  const [tenant] = await database
    .select()
    .from(tenants)
    .where(and(eq(tenants.id, tenantId), isNull(tenants.deletedAt)));

  if (!tenant) {
    return c.json({ error: 'Tenant not found' }, 404);
  }

  // Get user count
  const userCountResult = await database
    .select({ count: sql<number>`count(*)` })
    .from(userTenantMemberships)
    .where(eq(userTenantMemberships.tenantId, tenantId));

  // Get event count
  const eventCountResult = await database
    .select({ count: sql<number>`count(*)` })
    .from(events)
    .where(and(eq(events.tenantId, tenantId), isNull(events.deletedAt)));

  // Get booking count
  const bookingCountResult = await database
    .select({ count: sql<number>`count(*)` })
    .from(bookings)
    .where(eq(bookings.tenantId, tenantId));

  // Get total revenue
  const revenueResult = await database
    .select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
    .from(payments)
    .where(and(eq(payments.tenantId, tenantId), eq(payments.status, 'succeeded')));

  return c.json({
    tenant,
    stats: {
      userCount: userCountResult[0]?.count || 0,
      eventCount: eventCountResult[0]?.count || 0,
      bookingCount: bookingCountResult[0]?.count || 0,
      totalRevenue: revenueResult[0]?.total || 0,
    },
  });
});

/**
 * Create a new tenant
 */
app.post('/tenants', zValidator('json', createTenantSchema), async (c) => {
  const data = c.req.valid('json');
  const database = createDb(c.env.DB);
  const now = new Date();

  // Check if slug already exists
  const [existingTenant] = await database
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, data.slug));

  if (existingTenant) {
    return c.json({ error: 'Tenant slug already exists' }, 409);
  }

  // Check if owner email already exists
  const [existingUser] = await database
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, data.ownerEmail));

  const tenantId = ulid();
  const ownerId = existingUser?.id || ulid();

  // Create tenant
  await database.insert(tenants).values({
    id: tenantId,
    name: data.name,
    slug: data.slug,
    customDomain: data.customDomain || null,
    subscriptionTier: data.subscriptionTier,
    featureFlags: {},
    createdAt: now,
    updatedAt: now,
  });

  // Create owner user if doesn't exist
  if (!existingUser) {
    await database.insert(users).values({
      id: ownerId,
      email: data.ownerEmail,
      profileData: { firstName: data.ownerName },
      role: 'tenant_owner',
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Create tenant membership
  await database.insert(userTenantMemberships).values({
    id: ulid(),
    userId: ownerId,
    tenantId: tenantId,
    role: 'tenant_owner',
    permissions: {
      manageEvents: true,
      manageBookings: true,
      manageUsers: true,
      manageSettings: true,
      viewAnalytics: true,
      managePayments: true,
    },
    createdAt: now,
  });

  // Fetch created tenant
  const [newTenant] = await database
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId));

  return c.json({ tenant: newTenant }, 201);
});

/**
 * Update tenant
 */
app.patch('/tenants/:id', zValidator('json', updateTenantSchema), async (c) => {
  const tenantId = c.req.param('id');
  const updates = c.req.valid('json');
  const database = createDb(c.env.DB);

  const [tenant] = await database
    .select()
    .from(tenants)
    .where(and(eq(tenants.id, tenantId), isNull(tenants.deletedAt)));

  if (!tenant) {
    return c.json({ error: 'Tenant not found' }, 404);
  }

  // Check slug uniqueness if being updated
  if (updates.slug && updates.slug !== tenant.slug) {
    const [existingTenant] = await database
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.slug, updates.slug));

    if (existingTenant) {
      return c.json({ error: 'Tenant slug already exists' }, 409);
    }
  }

  // Merge feature flags if provided
  let featureFlags = tenant.featureFlags;
  if (updates.featureFlags) {
    featureFlags = { ...(featureFlags as Record<string, boolean>), ...updates.featureFlags };
  }

  await database
    .update(tenants)
    .set({
      name: updates.name ?? tenant.name,
      slug: updates.slug ?? tenant.slug,
      customDomain: updates.customDomain !== undefined ? updates.customDomain : tenant.customDomain,
      subscriptionTier: updates.subscriptionTier ?? tenant.subscriptionTier,
      featureFlags,
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, tenantId));

  const [updatedTenant] = await database
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId));

  return c.json({ tenant: updatedTenant });
});

/**
 * Delete (soft) tenant
 */
app.delete('/tenants/:id', async (c) => {
  const tenantId = c.req.param('id');
  const database = createDb(c.env.DB);

  const [tenant] = await database
    .select()
    .from(tenants)
    .where(and(eq(tenants.id, tenantId), isNull(tenants.deletedAt)));

  if (!tenant) {
    return c.json({ error: 'Tenant not found' }, 404);
  }

  await database
    .update(tenants)
    .set({
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, tenantId));

  return c.json({ success: true });
});

/**
 * Get platform analytics
 */
app.get('/analytics', zValidator('query', analyticsQuerySchema), async (c) => {
  const { startDate, endDate, tenantId } = c.req.valid('query');
  const database = createDb(c.env.DB);

  // Get total counts
  const tenantCount = await database
    .select({ count: sql<number>`count(*)` })
    .from(tenants)
    .where(isNull(tenants.deletedAt));

  const userCount = await database.select({ count: sql<number>`count(*)` }).from(users);

  const eventCount = await database
    .select({ count: sql<number>`count(*)` })
    .from(events)
    .where(isNull(events.deletedAt));

  const bookingCount = await database.select({ count: sql<number>`count(*)` }).from(bookings);

  // Get revenue
  const revenueResult = await database
    .select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
    .from(payments)
    .where(eq(payments.status, 'succeeded'));

  // Get tenant breakdown by tier
  const tierBreakdown = await database
    .select({
      tier: tenants.subscriptionTier,
      count: sql<number>`count(*)`,
    })
    .from(tenants)
    .where(isNull(tenants.deletedAt))
    .groupBy(tenants.subscriptionTier);

  // Get recent tenants
  const recentTenants = await database
    .select({
      id: tenants.id,
      name: tenants.name,
      createdAt: tenants.createdAt,
    })
    .from(tenants)
    .where(isNull(tenants.deletedAt))
    .orderBy(desc(tenants.createdAt))
    .limit(5);

  // Get recent bookings
  const recentBookings = await database
    .select({
      id: bookings.id,
      status: bookings.status,
      createdAt: bookings.createdAt,
    })
    .from(bookings)
    .orderBy(desc(bookings.createdAt))
    .limit(10);

  return c.json({
    summary: {
      totalTenants: tenantCount[0]?.count || 0,
      totalUsers: userCount[0]?.count || 0,
      totalEvents: eventCount[0]?.count || 0,
      totalBookings: bookingCount[0]?.count || 0,
      totalRevenue: revenueResult[0]?.total || 0,
    },
    tierBreakdown: tierBreakdown.reduce(
      (acc, item) => {
        acc[item.tier] = item.count;
        return acc;
      },
      {} as Record<string, number>
    ),
    recentTenants,
    recentBookings,
  });
});

/**
 * Get platform health
 */
app.get('/health', async (c) => {
  const database = createDb(c.env.DB);

  // Simple health checks
  const checks = {
    database: false,
    kv: false,
    r2: false,
  };

  // Check D1
  try {
    await database.select({ count: sql<number>`1` }).from(tenants).limit(1);
    checks.database = true;
  } catch {
    checks.database = false;
  }

  // Check KV
  try {
    await c.env.KV.get('health-check');
    checks.kv = true;
  } catch {
    checks.kv = false;
  }

  // Check R2
  try {
    await c.env.STORAGE.head('health-check');
    checks.r2 = true;
  } catch (error) {
    // R2 throws error if file doesn't exist, but connection is good
    checks.r2 = true;
  }

  const allHealthy = Object.values(checks).every(Boolean);

  return c.json({
    status: allHealthy ? 'healthy' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
  });
});

/**
 * List all users (global)
 */
app.get('/users', async (c) => {
  const database = createDb(c.env.DB);

  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '20');
  const offset = (page - 1) * limit;

  const userList = await database
    .select({
      id: users.id,
      email: users.email,
      profileData: users.profileData,
      role: users.role,
      emailVerified: users.emailVerified,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset);

  const countResult = await database.select({ count: sql<number>`count(*)` }).from(users);

  return c.json({
    users: userList,
    meta: {
      page,
      limit,
      total: countResult[0]?.count || 0,
    },
  });
});

/**
 * Update user role (global admin only)
 */
app.patch('/users/:id/role', async (c) => {
  const userId = c.req.param('id');
  const { role } = await c.req.json<{ role: string }>();
  const database = createDb(c.env.DB);

  const validRoles = ['global_admin', 'tenant_owner', 'tenant_admin', 'staff', 'attendee'] as const;
  type ValidRole = (typeof validRoles)[number];

  if (!validRoles.includes(role as ValidRole)) {
    return c.json({ error: 'Invalid role' }, 400);
  }

  const [user] = await database.select().from(users).where(eq(users.id, userId));

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  await database
    .update(users)
    .set({ role: role as ValidRole, updatedAt: new Date() })
    .where(eq(users.id, userId));

  return c.json({ success: true });
});

/**
 * Feature flag management
 */
app.get('/feature-flags', async (c) => {
  // Return available feature flags with descriptions
  const availableFlags = {
    aiFeatures: 'Enable AI-powered features (content generation, chatbot)',
    advancedAnalytics: 'Enable advanced analytics dashboard',
    customBranding: 'Allow custom branding and theming',
    multiCurrency: 'Enable multi-currency payments',
    paymentPlans: 'Allow payment plan / installment options',
    waitlist: 'Enable waitlist functionality',
    roomAllocation: 'Enable smart room allocation',
    emailCampaigns: 'Allow sending email campaigns',
    webhooks: 'Enable webhook integrations',
    apiAccess: 'Enable public API access',
    videoStreaming: 'Enable video content (Cloudflare Stream)',
    calendarSync: 'Enable calendar integrations',
  };

  return c.json({ availableFlags });
});

/**
 * Update tenant feature flags
 */
app.put('/tenants/:id/feature-flags', async (c) => {
  const tenantId = c.req.param('id');
  const { flags } = await c.req.json<{ flags: Record<string, boolean> }>();
  const database = createDb(c.env.DB);

  const [tenant] = await database
    .select()
    .from(tenants)
    .where(and(eq(tenants.id, tenantId), isNull(tenants.deletedAt)));

  if (!tenant) {
    return c.json({ error: 'Tenant not found' }, 404);
  }

  await database
    .update(tenants)
    .set({
      featureFlags: flags,
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, tenantId));

  return c.json({ success: true, featureFlags: flags });
});

export default app;
