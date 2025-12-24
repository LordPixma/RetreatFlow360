import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { ulid } from 'ulid';
import { eq, and, isNull, desc } from 'drizzle-orm';
import type { Env, Variables } from '@retreatflow360/shared-types';
import { venues, rooms } from '@retreatflow360/database';
import { createVenueSchema, createRoomSchema } from '@retreatflow360/validation';
import { requireTenantMembership, requireRole } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant';
import { NotFoundError } from '../middleware/error';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Apply tenant requirement
app.use('*', requireTenant);

// List venues
app.get('/', async (c) => {
  const db = c.get('db');
  const tenant = c.get('tenant')!;

  const venueList = await db
    .select()
    .from(venues)
    .where(and(eq(venues.tenantId, tenant.id), isNull(venues.deletedAt)))
    .orderBy(desc(venues.createdAt));

  return c.json({
    success: true,
    data: { venues: venueList },
  });
});

// Get venue with rooms
app.get('/:id', async (c) => {
  const { id } = c.req.param();
  const db = c.get('db');
  const tenant = c.get('tenant')!;

  const venue = await db
    .select()
    .from(venues)
    .where(and(eq(venues.id, id), eq(venues.tenantId, tenant.id), isNull(venues.deletedAt)))
    .limit(1)
    .then((r) => r[0]);

  if (!venue) {
    throw new NotFoundError('Venue not found');
  }

  const roomList = await db
    .select()
    .from(rooms)
    .where(and(eq(rooms.venueId, id), isNull(rooms.deletedAt)));

  return c.json({
    success: true,
    data: {
      venue: {
        ...venue,
        rooms: roomList,
      },
    },
  });
});

// Create venue
app.post(
  '/',
  requireTenantMembership,
  requireRole('tenant_owner', 'tenant_admin'),
  zValidator('json', createVenueSchema),
  async (c) => {
    const data = c.req.valid('json');
    const db = c.get('db');
    const tenant = c.get('tenant')!;

    const now = new Date();
    const venueId = ulid();

    await db.insert(venues).values({
      id: venueId,
      tenantId: tenant.id,
      name: data.name,
      description: data.description,
      address: data.address,
      city: data.city,
      country: data.country,
      latitude: data.latitude,
      longitude: data.longitude,
      capacity: data.capacity,
      amenities: data.amenities || [],
      contactInfo: data.contactInfo || {},
      createdAt: now,
      updatedAt: now,
    });

    const venue = await db
      .select()
      .from(venues)
      .where(eq(venues.id, venueId))
      .limit(1)
      .then((r) => r[0]);

    return c.json(
      {
        success: true,
        data: { venue },
      },
      201
    );
  }
);

// Update venue
app.patch(
  '/:id',
  requireTenantMembership,
  requireRole('tenant_owner', 'tenant_admin'),
  zValidator('json', createVenueSchema.partial()),
  async (c) => {
    const { id } = c.req.param();
    const data = c.req.valid('json');
    const db = c.get('db');
    const tenant = c.get('tenant')!;

    const venue = await db
      .select()
      .from(venues)
      .where(and(eq(venues.id, id), eq(venues.tenantId, tenant.id), isNull(venues.deletedAt)))
      .limit(1)
      .then((r) => r[0]);

    if (!venue) {
      throw new NotFoundError('Venue not found');
    }

    await db
      .update(venues)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(venues.id, id));

    const updatedVenue = await db
      .select()
      .from(venues)
      .where(eq(venues.id, id))
      .limit(1)
      .then((r) => r[0]);

    return c.json({
      success: true,
      data: { venue: updatedVenue },
    });
  }
);

// Delete venue
app.delete('/:id', requireTenantMembership, requireRole('tenant_owner', 'tenant_admin'), async (c) => {
  const { id } = c.req.param();
  const db = c.get('db');
  const tenant = c.get('tenant')!;

  const venue = await db
    .select()
    .from(venues)
    .where(and(eq(venues.id, id), eq(venues.tenantId, tenant.id), isNull(venues.deletedAt)))
    .limit(1)
    .then((r) => r[0]);

  if (!venue) {
    throw new NotFoundError('Venue not found');
  }

  // Soft delete venue and its rooms
  const now = new Date();
  await db.update(venues).set({ deletedAt: now }).where(eq(venues.id, id));
  await db.update(rooms).set({ deletedAt: now }).where(eq(rooms.venueId, id));

  return c.json({ success: true });
});

// --- Room Routes ---

// Create room
app.post(
  '/:venueId/rooms',
  requireTenantMembership,
  requireRole('tenant_owner', 'tenant_admin'),
  zValidator('json', createRoomSchema),
  async (c) => {
    const { venueId } = c.req.param();
    const data = c.req.valid('json');
    const db = c.get('db');
    const tenant = c.get('tenant')!;

    // Verify venue exists and belongs to tenant
    const venue = await db
      .select()
      .from(venues)
      .where(and(eq(venues.id, venueId), eq(venues.tenantId, tenant.id), isNull(venues.deletedAt)))
      .limit(1)
      .then((r) => r[0]);

    if (!venue) {
      throw new NotFoundError('Venue not found');
    }

    const now = new Date();
    const roomId = ulid();

    await db.insert(rooms).values({
      id: roomId,
      venueId,
      tenantId: tenant.id,
      name: data.name,
      type: data.type,
      capacity: data.capacity,
      pricePerNight: data.pricePerNight,
      currency: data.currency,
      accessibilityFeatures: data.accessibilityFeatures || [],
      amenities: data.amenities || [],
      floorNumber: data.floorNumber,
      createdAt: now,
      updatedAt: now,
    });

    const room = await db
      .select()
      .from(rooms)
      .where(eq(rooms.id, roomId))
      .limit(1)
      .then((r) => r[0]);

    return c.json(
      {
        success: true,
        data: { room },
      },
      201
    );
  }
);

// Update room
app.patch(
  '/:venueId/rooms/:roomId',
  requireTenantMembership,
  requireRole('tenant_owner', 'tenant_admin'),
  zValidator('json', createRoomSchema.partial()),
  async (c) => {
    const { venueId, roomId } = c.req.param();
    const data = c.req.valid('json');
    const db = c.get('db');
    const tenant = c.get('tenant')!;

    const room = await db
      .select()
      .from(rooms)
      .where(
        and(
          eq(rooms.id, roomId),
          eq(rooms.venueId, venueId),
          eq(rooms.tenantId, tenant.id),
          isNull(rooms.deletedAt)
        )
      )
      .limit(1)
      .then((r) => r[0]);

    if (!room) {
      throw new NotFoundError('Room not found');
    }

    await db
      .update(rooms)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(rooms.id, roomId));

    const updatedRoom = await db
      .select()
      .from(rooms)
      .where(eq(rooms.id, roomId))
      .limit(1)
      .then((r) => r[0]);

    return c.json({
      success: true,
      data: { room: updatedRoom },
    });
  }
);

// Delete room
app.delete(
  '/:venueId/rooms/:roomId',
  requireTenantMembership,
  requireRole('tenant_owner', 'tenant_admin'),
  async (c) => {
    const { venueId, roomId } = c.req.param();
    const db = c.get('db');
    const tenant = c.get('tenant')!;

    const room = await db
      .select()
      .from(rooms)
      .where(
        and(
          eq(rooms.id, roomId),
          eq(rooms.venueId, venueId),
          eq(rooms.tenantId, tenant.id),
          isNull(rooms.deletedAt)
        )
      )
      .limit(1)
      .then((r) => r[0]);

    if (!room) {
      throw new NotFoundError('Room not found');
    }

    await db.update(rooms).set({ deletedAt: new Date() }).where(eq(rooms.id, roomId));

    return c.json({ success: true });
  }
);

export default app;
