import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { ulid } from 'ulid';
import { eq, and, isNull, asc } from 'drizzle-orm';
import type { Env, Variables } from '@retreatflow360/shared-types';
import { events, eventSessions, rooms } from '@retreatflow360/database';
import { createSessionSchema, updateSessionSchema } from '@retreatflow360/validation';
import { requireTenantMembership, requireRole } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant';
import { NotFoundError } from '../middleware/error';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Apply tenant requirement to all routes
app.use('*', requireTenant);

/**
 * Helper to verify event exists and belongs to tenant
 */
async function getEvent(db: ReturnType<typeof import('@retreatflow360/database').createDb>, eventId: string, tenantId: string) {
  const event = await db
    .select({ id: events.id, title: events.title })
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.tenantId, tenantId), isNull(events.deletedAt)))
    .limit(1)
    .then((r) => r[0]);

  if (!event) {
    throw new NotFoundError('Event not found');
  }

  return event;
}

// List sessions for an event
app.get('/:eventId/sessions', async (c) => {
  const { eventId } = c.req.param();
  const db = c.get('db');
  const tenant = c.get('tenant')!;

  // Verify event exists
  await getEvent(db, eventId, tenant.id);

  const sessions = await db
    .select()
    .from(eventSessions)
    .where(eq(eventSessions.eventId, eventId))
    .orderBy(asc(eventSessions.startTime));

  // Get room info for sessions with rooms
  const roomIds = sessions.filter((s) => s.roomId).map((s) => s.roomId!);
  const roomMap = new Map<string, { id: string; name: string; type: string }>();

  if (roomIds.length > 0) {
    const roomList = await db
      .select({
        id: rooms.id,
        name: rooms.name,
        type: rooms.type,
      })
      .from(rooms)
      .where(and(eq(rooms.tenantId, tenant.id), isNull(rooms.deletedAt)));

    for (const room of roomList) {
      roomMap.set(room.id, room);
    }
  }

  return c.json({
    success: true,
    data: {
      sessions: sessions.map((s) => ({
        ...s,
        room: s.roomId ? roomMap.get(s.roomId) : undefined,
      })),
    },
  });
});

// Get single session
app.get('/:eventId/sessions/:sessionId', async (c) => {
  const { eventId, sessionId } = c.req.param();
  const db = c.get('db');
  const tenant = c.get('tenant')!;

  // Verify event exists
  await getEvent(db, eventId, tenant.id);

  const session = await db
    .select()
    .from(eventSessions)
    .where(and(eq(eventSessions.id, sessionId), eq(eventSessions.eventId, eventId)))
    .limit(1)
    .then((r) => r[0]);

  if (!session) {
    throw new NotFoundError('Session not found');
  }

  // Get room info if attached
  let room = null;
  if (session.roomId) {
    room = await db
      .select({
        id: rooms.id,
        name: rooms.name,
        type: rooms.type,
        capacity: rooms.capacity,
      })
      .from(rooms)
      .where(eq(rooms.id, session.roomId))
      .limit(1)
      .then((r) => r[0]);
  }

  return c.json({
    success: true,
    data: {
      session: {
        ...session,
        room,
      },
    },
  });
});

// Create session
app.post(
  '/:eventId/sessions',
  requireTenantMembership,
  requireRole('tenant_owner', 'tenant_admin', 'staff'),
  zValidator('json', createSessionSchema),
  async (c) => {
    const { eventId } = c.req.param();
    const data = c.req.valid('json');
    const db = c.get('db');
    const tenant = c.get('tenant')!;

    // Verify event exists
    await getEvent(db, eventId, tenant.id);

    // Validate room belongs to tenant if provided
    if (data.roomId) {
      const room = await db
        .select({ id: rooms.id })
        .from(rooms)
        .where(and(eq(rooms.id, data.roomId), eq(rooms.tenantId, tenant.id), isNull(rooms.deletedAt)))
        .limit(1)
        .then((r) => r[0]);

      if (!room) {
        return c.json(
          {
            success: false,
            error: {
              code: 'INVALID_ROOM',
              message: 'Room not found or does not belong to this tenant',
            },
          },
          400
        );
      }
    }

    const now = new Date();
    const sessionId = ulid();

    await db.insert(eventSessions).values({
      id: sessionId,
      eventId,
      tenantId: tenant.id,
      title: data.title,
      description: data.description,
      startTime: new Date(data.startTime),
      endTime: new Date(data.endTime),
      roomId: data.roomId,
      maxParticipants: data.maxParticipants,
      sessionType: data.sessionType,
      createdAt: now,
    });

    const session = await db
      .select()
      .from(eventSessions)
      .where(eq(eventSessions.id, sessionId))
      .limit(1)
      .then((r) => r[0]);

    return c.json(
      {
        success: true,
        data: { session },
      },
      201
    );
  }
);

// Update session
app.patch(
  '/:eventId/sessions/:sessionId',
  requireTenantMembership,
  requireRole('tenant_owner', 'tenant_admin', 'staff'),
  zValidator('json', updateSessionSchema),
  async (c) => {
    const { eventId, sessionId } = c.req.param();
    const data = c.req.valid('json');
    const db = c.get('db');
    const tenant = c.get('tenant')!;

    // Verify event exists
    await getEvent(db, eventId, tenant.id);

    const session = await db
      .select()
      .from(eventSessions)
      .where(and(eq(eventSessions.id, sessionId), eq(eventSessions.eventId, eventId)))
      .limit(1)
      .then((r) => r[0]);

    if (!session) {
      throw new NotFoundError('Session not found');
    }

    // Validate room belongs to tenant if being changed
    if (data.roomId && data.roomId !== session.roomId) {
      const room = await db
        .select({ id: rooms.id })
        .from(rooms)
        .where(and(eq(rooms.id, data.roomId), eq(rooms.tenantId, tenant.id), isNull(rooms.deletedAt)))
        .limit(1)
        .then((r) => r[0]);

      if (!room) {
        return c.json(
          {
            success: false,
            error: {
              code: 'INVALID_ROOM',
              message: 'Room not found or does not belong to this tenant',
            },
          },
          400
        );
      }
    }

    const updateData: Record<string, unknown> = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.startTime !== undefined) updateData.startTime = new Date(data.startTime);
    if (data.endTime !== undefined) updateData.endTime = new Date(data.endTime);
    if (data.roomId !== undefined) updateData.roomId = data.roomId;
    if (data.maxParticipants !== undefined) updateData.maxParticipants = data.maxParticipants;
    if (data.sessionType !== undefined) updateData.sessionType = data.sessionType;

    if (Object.keys(updateData).length > 0) {
      await db.update(eventSessions).set(updateData).where(eq(eventSessions.id, sessionId));
    }

    const updatedSession = await db
      .select()
      .from(eventSessions)
      .where(eq(eventSessions.id, sessionId))
      .limit(1)
      .then((r) => r[0]);

    return c.json({
      success: true,
      data: { session: updatedSession },
    });
  }
);

// Delete session
app.delete(
  '/:eventId/sessions/:sessionId',
  requireTenantMembership,
  requireRole('tenant_owner', 'tenant_admin'),
  async (c) => {
    const { eventId, sessionId } = c.req.param();
    const db = c.get('db');
    const tenant = c.get('tenant')!;

    // Verify event exists
    await getEvent(db, eventId, tenant.id);

    const session = await db
      .select()
      .from(eventSessions)
      .where(and(eq(eventSessions.id, sessionId), eq(eventSessions.eventId, eventId)))
      .limit(1)
      .then((r) => r[0]);

    if (!session) {
      throw new NotFoundError('Session not found');
    }

    // Hard delete sessions (they don't have soft delete)
    await db.delete(eventSessions).where(eq(eventSessions.id, sessionId));

    return c.json({ success: true });
  }
);

export default app;
