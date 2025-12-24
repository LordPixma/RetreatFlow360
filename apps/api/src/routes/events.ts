import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { ulid } from 'ulid';
import { eq, and, isNull, desc, asc, like, gte, lte } from 'drizzle-orm';
import type { Env, Variables } from '@retreatflow360/shared-types';
import { events, venues } from '@retreatflow360/database';
import {
  createEventSchema,
  updateEventSchema,
  listEventsSchema,
} from '@retreatflow360/validation';
import { requireTenantMembership, requireRole } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant';
import { NotFoundError } from '../middleware/error';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Apply tenant requirement to all routes
app.use('*', requireTenant);

/**
 * Generate a URL-friendly slug from title
 */
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 100);
}

// List events
app.get('/', zValidator('query', listEventsSchema), async (c) => {
  const { page, limit, status, search, startAfter, startBefore, sortBy, sortOrder } =
    c.req.valid('query');
  const db = c.get('db');
  const tenant = c.get('tenant')!;

  const conditions = [eq(events.tenantId, tenant.id), isNull(events.deletedAt)];

  if (status) {
    conditions.push(eq(events.status, status));
  }

  if (search) {
    conditions.push(like(events.title, `%${search}%`));
  }

  if (startAfter) {
    conditions.push(gte(events.startDate, new Date(startAfter)));
  }

  if (startBefore) {
    conditions.push(lte(events.startDate, new Date(startBefore)));
  }

  const sortColumn = sortBy === 'startDate' ? events.startDate : sortBy === 'title' ? events.title : events.createdAt;
  const orderFn = sortOrder === 'asc' ? asc : desc;

  const offset = (page - 1) * limit;

  const [eventList, countResult] = await Promise.all([
    db
      .select({
        id: events.id,
        title: events.title,
        slug: events.slug,
        shortDescription: events.shortDescription,
        startDate: events.startDate,
        endDate: events.endDate,
        status: events.status,
        visibility: events.visibility,
        maxAttendees: events.maxAttendees,
        images: events.images,
        venueId: events.venueId,
      })
      .from(events)
      .where(and(...conditions))
      .orderBy(orderFn(sortColumn))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: events.id })
      .from(events)
      .where(and(...conditions)),
  ]);

  // Get venue info for events with venues
  const venueIds = eventList.filter((e) => e.venueId).map((e) => e.venueId!);
  const venueMap = new Map<string, { id: string; name: string; city: string | null; country: string | null }>();

  if (venueIds.length > 0) {
    const venueList = await db
      .select({
        id: venues.id,
        name: venues.name,
        city: venues.city,
        country: venues.country,
      })
      .from(venues)
      .where(and(eq(venues.tenantId, tenant.id), isNull(venues.deletedAt)));

    for (const venue of venueList) {
      venueMap.set(venue.id, venue);
    }
  }

  const total = countResult.length;
  const totalPages = Math.ceil(total / limit);

  return c.json({
    success: true,
    data: {
      events: eventList.map((e) => ({
        ...e,
        venue: e.venueId ? venueMap.get(e.venueId) : undefined,
        currentAttendees: 0, // TODO: Calculate from bookings
      })),
    },
    meta: {
      page,
      limit,
      total,
      totalPages,
    },
  });
});

// Get single event
app.get('/:id', async (c) => {
  const { id } = c.req.param();
  const db = c.get('db');
  const tenant = c.get('tenant')!;

  const event = await db
    .select()
    .from(events)
    .where(and(eq(events.id, id), eq(events.tenantId, tenant.id), isNull(events.deletedAt)))
    .limit(1)
    .then((r) => r[0]);

  if (!event) {
    throw new NotFoundError('Event not found');
  }

  // Get venue if attached
  let venue = null;
  if (event.venueId) {
    venue = await db
      .select()
      .from(venues)
      .where(eq(venues.id, event.venueId))
      .limit(1)
      .then((r) => r[0]);
  }

  return c.json({
    success: true,
    data: {
      event: {
        ...event,
        venue,
        currentAttendees: 0, // TODO: Calculate from bookings
      },
    },
  });
});

// Create event
app.post('/', requireTenantMembership, requireRole('tenant_owner', 'tenant_admin', 'staff'), zValidator('json', createEventSchema), async (c) => {
  const data = c.req.valid('json');
  const db = c.get('db');
  const tenant = c.get('tenant')!;
  const user = c.get('user')!;

  // Generate slug if not provided
  const slug = data.slug || generateSlug(data.title);

  // Check for slug uniqueness within tenant
  const existing = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.tenantId, tenant.id), eq(events.slug, slug), isNull(events.deletedAt)))
    .limit(1)
    .then((r) => r[0]);

  if (existing) {
    return c.json(
      {
        success: false,
        error: {
          code: 'SLUG_EXISTS',
          message: 'An event with this slug already exists',
        },
      },
      409
    );
  }

  // Validate venue belongs to tenant if provided
  if (data.venueId) {
    const venue = await db
      .select({ id: venues.id })
      .from(venues)
      .where(and(eq(venues.id, data.venueId), eq(venues.tenantId, tenant.id), isNull(venues.deletedAt)))
      .limit(1)
      .then((r) => r[0]);

    if (!venue) {
      return c.json(
        {
          success: false,
          error: {
            code: 'INVALID_VENUE',
            message: 'Venue not found or does not belong to this tenant',
          },
        },
        400
      );
    }
  }

  const now = new Date();
  const eventId = ulid();

  // Add IDs to pricing tiers
  const pricingTiers = (data.pricingTiers || []).map((tier) => ({
    ...tier,
    id: ulid(),
  }));

  // Add IDs to custom fields
  const customFields = (data.customFields || []).map((field) => ({
    ...field,
    id: ulid(),
  }));

  await db.insert(events).values({
    id: eventId,
    tenantId: tenant.id,
    title: data.title,
    slug,
    description: data.description,
    shortDescription: data.shortDescription,
    startDate: new Date(data.startDate),
    endDate: new Date(data.endDate),
    timezone: data.timezone,
    maxAttendees: data.maxAttendees,
    venueId: data.venueId,
    visibility: data.visibility,
    pricingTiers,
    customFields,
    createdAt: now,
    updatedAt: now,
  });

  const event = await db.select().from(events).where(eq(events.id, eventId)).limit(1).then((r) => r[0]);

  return c.json(
    {
      success: true,
      data: { event },
    },
    201
  );
});

// Update event
app.patch('/:id', requireTenantMembership, requireRole('tenant_owner', 'tenant_admin', 'staff'), zValidator('json', updateEventSchema), async (c) => {
  const { id } = c.req.param();
  const data = c.req.valid('json');
  const db = c.get('db');
  const tenant = c.get('tenant')!;

  const event = await db
    .select()
    .from(events)
    .where(and(eq(events.id, id), eq(events.tenantId, tenant.id), isNull(events.deletedAt)))
    .limit(1)
    .then((r) => r[0]);

  if (!event) {
    throw new NotFoundError('Event not found');
  }

  // Check slug uniqueness if being changed
  if (data.slug && data.slug !== event.slug) {
    const existing = await db
      .select({ id: events.id })
      .from(events)
      .where(and(eq(events.tenantId, tenant.id), eq(events.slug, data.slug), isNull(events.deletedAt)))
      .limit(1)
      .then((r) => r[0]);

    if (existing) {
      return c.json(
        {
          success: false,
          error: {
            code: 'SLUG_EXISTS',
            message: 'An event with this slug already exists',
          },
        },
        409
      );
    }
  }

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (data.title !== undefined) updateData.title = data.title;
  if (data.slug !== undefined) updateData.slug = data.slug;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.shortDescription !== undefined) updateData.shortDescription = data.shortDescription;
  if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate);
  if (data.endDate !== undefined) updateData.endDate = new Date(data.endDate);
  if (data.timezone !== undefined) updateData.timezone = data.timezone;
  if (data.maxAttendees !== undefined) updateData.maxAttendees = data.maxAttendees;
  if (data.venueId !== undefined) updateData.venueId = data.venueId;
  if (data.visibility !== undefined) updateData.visibility = data.visibility;
  if (data.status !== undefined) {
    updateData.status = data.status;
    if (data.status === 'published' && !event.publishedAt) {
      updateData.publishedAt = new Date();
    }
  }
  if (data.pricingTiers !== undefined) {
    updateData.pricingTiers = data.pricingTiers.map((tier) => ({
      ...tier,
      id: ulid(),
    }));
  }
  if (data.customFields !== undefined) {
    updateData.customFields = data.customFields.map((field) => ({
      ...field,
      id: ulid(),
    }));
  }

  await db.update(events).set(updateData).where(eq(events.id, id));

  const updatedEvent = await db.select().from(events).where(eq(events.id, id)).limit(1).then((r) => r[0]);

  return c.json({
    success: true,
    data: { event: updatedEvent },
  });
});

// Delete event (soft delete)
app.delete('/:id', requireTenantMembership, requireRole('tenant_owner', 'tenant_admin'), async (c) => {
  const { id } = c.req.param();
  const db = c.get('db');
  const tenant = c.get('tenant')!;

  const event = await db
    .select()
    .from(events)
    .where(and(eq(events.id, id), eq(events.tenantId, tenant.id), isNull(events.deletedAt)))
    .limit(1)
    .then((r) => r[0]);

  if (!event) {
    throw new NotFoundError('Event not found');
  }

  await db.update(events).set({ deletedAt: new Date() }).where(eq(events.id, id));

  return c.json({ success: true });
});

export default app;
