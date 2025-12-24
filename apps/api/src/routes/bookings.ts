import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { ulid } from 'ulid';
import { eq, and, isNull, desc, asc, sql } from 'drizzle-orm';
import type { Env, Variables } from '@retreatflow360/shared-types';
import { bookings, events, roomAllocations, rooms, waitlistEntries } from '@retreatflow360/database';
import {
  createBookingSchema,
  updateBookingSchema,
  listBookingsSchema,
  cancelBookingSchema,
  createWaitlistEntrySchema,
} from '@retreatflow360/validation';
import { requireTenantMembership, requireRole } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant';
import { NotFoundError, ForbiddenError, ConflictError } from '../middleware/error';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Apply tenant requirement
app.use('*', requireTenant);

/**
 * Check if user is staff for this tenant
 */
function isStaffUser(
  user: { role: string; tenantMemberships: Array<{ tenantId: string; role: string }> },
  tenantId: string
): boolean {
  return (
    user.role === 'global_admin' ||
    user.tenantMemberships.some(
      (m) => m.tenantId === tenantId && ['tenant_owner', 'tenant_admin', 'staff'].includes(m.role)
    )
  );
}

// List bookings (for current user or all for staff)
app.get('/', zValidator('query', listBookingsSchema), async (c) => {
  const { page, limit, eventId, userId, status, sortBy, sortOrder } = c.req.valid('query');
  const db = c.get('db');
  const tenant = c.get('tenant')!;
  const user = c.get('user')!;

  const isStaff = isStaffUser(user, tenant.id);

  const conditions = [eq(bookings.tenantId, tenant.id)];

  // Non-staff users can only see their own bookings
  if (!isStaff) {
    conditions.push(eq(bookings.userId, user.sub));
  } else if (userId) {
    // Staff can filter by userId
    conditions.push(eq(bookings.userId, userId));
  }

  if (eventId) {
    conditions.push(eq(bookings.eventId, eventId));
  }

  if (status) {
    conditions.push(eq(bookings.status, status));
  }

  const sortColumn = sortBy === 'status' ? bookings.status : bookings.createdAt;
  const orderFn = sortOrder === 'asc' ? asc : desc;
  const offset = (page - 1) * limit;

  const [bookingList, countResult] = await Promise.all([
    db
      .select({
        id: bookings.id,
        eventId: bookings.eventId,
        userId: bookings.userId,
        status: bookings.status,
        pricingTier: bookings.pricingTier,
        baseAmount: bookings.baseAmount,
        currency: bookings.currency,
        roomAllocationId: bookings.roomAllocationId,
        createdAt: bookings.createdAt,
        confirmedAt: bookings.confirmedAt,
      })
      .from(bookings)
      .where(and(...conditions))
      .orderBy(orderFn(sortColumn))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(bookings)
      .where(and(...conditions)),
  ]);

  // Get event info
  const eventIds = [...new Set(bookingList.map((b) => b.eventId))];
  const eventMap = new Map<string, { title: string; startDate: Date; endDate: Date }>();

  if (eventIds.length > 0) {
    const eventList = await db
      .select({
        id: events.id,
        title: events.title,
        startDate: events.startDate,
        endDate: events.endDate,
      })
      .from(events)
      .where(eq(events.tenantId, tenant.id));

    for (const event of eventList) {
      eventMap.set(event.id, {
        title: event.title,
        startDate: event.startDate,
        endDate: event.endDate,
      });
    }
  }

  const total = countResult[0]?.count ?? 0;
  const totalPages = Math.ceil(total / limit);

  return c.json({
    success: true,
    data: {
      bookings: bookingList.map((b) => ({
        ...b,
        event: eventMap.get(b.eventId),
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

// Get single booking
app.get('/:id', async (c) => {
  const { id } = c.req.param();
  const db = c.get('db');
  const tenant = c.get('tenant')!;
  const user = c.get('user')!;

  const booking = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.id, id), eq(bookings.tenantId, tenant.id)))
    .limit(1)
    .then((r) => r[0]);

  if (!booking) {
    throw new NotFoundError('Booking not found');
  }

  // Check access
  const isStaff = isStaffUser(user, tenant.id);

  if (!isStaff && booking.userId !== user.sub) {
    throw new ForbiddenError('You do not have access to this booking');
  }

  // Get related data
  const event = await db
    .select()
    .from(events)
    .where(eq(events.id, booking.eventId))
    .limit(1)
    .then((r) => r[0]);

  let roomAllocation = null;
  if (booking.roomAllocationId) {
    const allocation = await db
      .select()
      .from(roomAllocations)
      .where(eq(roomAllocations.id, booking.roomAllocationId))
      .limit(1)
      .then((r) => r[0]);

    if (allocation) {
      const room = await db
        .select()
        .from(rooms)
        .where(eq(rooms.id, allocation.roomId))
        .limit(1)
        .then((r) => r[0]);

      roomAllocation = {
        ...allocation,
        room,
      };
    }
  }

  return c.json({
    success: true,
    data: {
      booking: {
        ...booking,
        event,
        roomAllocation,
      },
    },
  });
});

// Create booking
app.post('/', zValidator('json', createBookingSchema), async (c) => {
  const data = c.req.valid('json');
  const db = c.get('db');
  const tenant = c.get('tenant')!;
  const user = c.get('user')!;

  // Verify event exists and is published
  const event = await db
    .select()
    .from(events)
    .where(
      and(
        eq(events.id, data.eventId),
        eq(events.tenantId, tenant.id),
        eq(events.status, 'published'),
        isNull(events.deletedAt)
      )
    )
    .limit(1)
    .then((r) => r[0]);

  if (!event) {
    throw new NotFoundError('Event not found or not available for booking');
  }

  // Validate pricing tier
  const pricingTiers = (event.pricingTiers as Array<{ id: string; name: string; price: number; currency: string }>) || [];
  const selectedTier = pricingTiers.find((t) => t.id === data.pricingTier || t.name === data.pricingTier);

  if (!selectedTier) {
    return c.json(
      {
        success: false,
        error: {
          code: 'INVALID_PRICING_TIER',
          message: 'Selected pricing tier is not valid for this event',
        },
      },
      400
    );
  }

  // Check for existing booking
  const existingBooking = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(
      and(
        eq(bookings.eventId, data.eventId),
        eq(bookings.userId, user.sub),
        eq(bookings.tenantId, tenant.id)
      )
    )
    .limit(1)
    .then((r) => r[0]);

  if (existingBooking) {
    throw new ConflictError('You already have a booking for this event');
  }

  // TODO: Check capacity via Durable Object for atomic reservation
  // For now, do a simple count check
  const bookingCount = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(
      and(
        eq(bookings.eventId, data.eventId),
        eq(bookings.tenantId, tenant.id)
      )
    );

  if (event.maxAttendees && bookingCount.length >= event.maxAttendees) {
    return c.json(
      {
        success: false,
        error: {
          code: 'EVENT_FULL',
          message: 'This event has reached maximum capacity',
        },
      },
      409
    );
  }

  const now = new Date();
  const bookingId = ulid();

  // Handle room allocation if requested
  let roomAllocationId: string | undefined;
  if (data.roomId) {
    const room = await db
      .select()
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
            message: 'Selected room not found',
          },
        },
        400
      );
    }

    // TODO: Check room availability via Durable Object
    roomAllocationId = ulid();
    await db.insert(roomAllocations).values({
      id: roomAllocationId,
      roomId: data.roomId,
      eventId: data.eventId,
      tenantId: tenant.id,
      bookingId,
      checkInDate: event.startDate,
      checkOutDate: event.endDate,
      status: 'reserved',
      createdAt: now,
    });
  }

  // Create booking
  await db.insert(bookings).values({
    id: bookingId,
    eventId: data.eventId,
    userId: user.sub,
    tenantId: tenant.id,
    status: 'pending',
    pricingTier: selectedTier.id,
    baseAmount: selectedTier.price,
    currency: selectedTier.currency,
    roomAllocationId,
    customFieldResponses: data.customFieldResponses || {},
    dietaryNotes: data.dietaryNotes,
    accessibilityNotes: data.accessibilityNotes,
    createdAt: now,
    updatedAt: now,
  });

  const booking = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1)
    .then((r) => r[0]);

  // TODO: Queue confirmation email

  return c.json(
    {
      success: true,
      data: { booking },
    },
    201
  );
});

// Update booking (staff only for most operations)
app.patch('/:id', zValidator('json', updateBookingSchema), async (c) => {
  const { id } = c.req.param();
  const data = c.req.valid('json');
  const db = c.get('db');
  const tenant = c.get('tenant')!;
  const user = c.get('user')!;

  const booking = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.id, id), eq(bookings.tenantId, tenant.id)))
    .limit(1)
    .then((r) => r[0]);

  if (!booking) {
    throw new NotFoundError('Booking not found');
  }

  const isStaff = isStaffUser(user, tenant.id);

  // Users can only cancel their own bookings
  if (!isStaff && booking.userId !== user.sub) {
    throw new ForbiddenError('You do not have access to this booking');
  }

  if (!isStaff && data.status && data.status !== 'cancelled') {
    throw new ForbiddenError('You can only cancel your own booking');
  }

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (data.status === 'confirmed' && isStaff) {
    updateData.status = 'confirmed';
    updateData.confirmedAt = new Date();

    // Update room allocation status
    if (booking.roomAllocationId) {
      await db
        .update(roomAllocations)
        .set({ status: 'confirmed' })
        .where(eq(roomAllocations.id, booking.roomAllocationId));
    }
  }

  if (data.status === 'cancelled') {
    updateData.status = 'cancelled';
    updateData.cancelledAt = new Date();

    // Release room allocation
    if (booking.roomAllocationId) {
      await db
        .update(roomAllocations)
        .set({ status: 'cancelled' })
        .where(eq(roomAllocations.id, booking.roomAllocationId));
    }

    // TODO: Promote from waitlist if event allows
  }

  if (data.internalNotes !== undefined && isStaff) {
    updateData.internalNotes = data.internalNotes;
  }

  if (data.dietaryNotes !== undefined) {
    updateData.dietaryNotes = data.dietaryNotes;
  }

  if (data.accessibilityNotes !== undefined) {
    updateData.accessibilityNotes = data.accessibilityNotes;
  }

  await db.update(bookings).set(updateData).where(eq(bookings.id, id));

  const updatedBooking = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, id))
    .limit(1)
    .then((r) => r[0]);

  return c.json({
    success: true,
    data: { booking: updatedBooking },
  });
});

// Cancel booking with reason
app.post('/:id/cancel', zValidator('json', cancelBookingSchema), async (c) => {
  const { id } = c.req.param();
  const { reason } = c.req.valid('json');
  const db = c.get('db');
  const tenant = c.get('tenant')!;
  const user = c.get('user')!;

  const booking = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.id, id), eq(bookings.tenantId, tenant.id)))
    .limit(1)
    .then((r) => r[0]);

  if (!booking) {
    throw new NotFoundError('Booking not found');
  }

  const isStaff = isStaffUser(user, tenant.id);

  // Users can only cancel their own bookings
  if (!isStaff && booking.userId !== user.sub) {
    throw new ForbiddenError('You do not have access to this booking');
  }

  if (booking.status === 'cancelled') {
    return c.json(
      {
        success: false,
        error: {
          code: 'ALREADY_CANCELLED',
          message: 'This booking has already been cancelled',
        },
      },
      400
    );
  }

  // Update booking
  await db
    .update(bookings)
    .set({
      status: 'cancelled',
      cancelledAt: new Date(),
      cancellationReason: reason,
      updatedAt: new Date(),
    })
    .where(eq(bookings.id, id));

  // Release room allocation
  if (booking.roomAllocationId) {
    await db
      .update(roomAllocations)
      .set({ status: 'cancelled' })
      .where(eq(roomAllocations.id, booking.roomAllocationId));
  }

  // TODO: Promote from waitlist if event allows
  // TODO: Queue refund if applicable
  // TODO: Send cancellation email

  const updatedBooking = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, id))
    .limit(1)
    .then((r) => r[0]);

  return c.json({
    success: true,
    data: { booking: updatedBooking },
  });
});

// --- Waitlist Routes ---

// Join waitlist for an event
app.post('/waitlist', zValidator('json', createWaitlistEntrySchema), async (c) => {
  const data = c.req.valid('json');
  const db = c.get('db');
  const tenant = c.get('tenant')!;
  const user = c.get('user')!;

  // Verify event exists and is published
  const event = await db
    .select()
    .from(events)
    .where(
      and(
        eq(events.id, data.eventId),
        eq(events.tenantId, tenant.id),
        eq(events.status, 'published'),
        isNull(events.deletedAt)
      )
    )
    .limit(1)
    .then((r) => r[0]);

  if (!event) {
    throw new NotFoundError('Event not found or not available');
  }

  // Check if waitlist is enabled
  const settings = (event.settings as { allowWaitlist?: boolean }) || {};
  if (!settings.allowWaitlist) {
    return c.json(
      {
        success: false,
        error: {
          code: 'WAITLIST_DISABLED',
          message: 'Waitlist is not enabled for this event',
        },
      },
      400
    );
  }

  // Check for existing booking
  const existingBooking = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(
      and(
        eq(bookings.eventId, data.eventId),
        eq(bookings.userId, user.sub),
        eq(bookings.tenantId, tenant.id)
      )
    )
    .limit(1)
    .then((r) => r[0]);

  if (existingBooking) {
    return c.json(
      {
        success: false,
        error: {
          code: 'ALREADY_BOOKED',
          message: 'You already have a booking for this event',
        },
      },
      409
    );
  }

  // Check for existing waitlist entry
  const existingEntry = await db
    .select({ id: waitlistEntries.id })
    .from(waitlistEntries)
    .where(
      and(
        eq(waitlistEntries.eventId, data.eventId),
        eq(waitlistEntries.userId, user.sub),
        eq(waitlistEntries.tenantId, tenant.id)
      )
    )
    .limit(1)
    .then((r) => r[0]);

  if (existingEntry) {
    return c.json(
      {
        success: false,
        error: {
          code: 'ALREADY_ON_WAITLIST',
          message: 'You are already on the waitlist for this event',
        },
      },
      409
    );
  }

  // Get current max position
  const maxPositionResult = await db
    .select({ maxPos: sql<number>`COALESCE(MAX(position), 0)` })
    .from(waitlistEntries)
    .where(and(eq(waitlistEntries.eventId, data.eventId), eq(waitlistEntries.tenantId, tenant.id)));

  const position = (maxPositionResult[0]?.maxPos ?? 0) + 1;

  const entryId = ulid();
  await db.insert(waitlistEntries).values({
    id: entryId,
    eventId: data.eventId,
    userId: user.sub,
    tenantId: tenant.id,
    position,
    pricingTier: data.pricingTier,
    createdAt: new Date(),
  });

  const entry = await db
    .select()
    .from(waitlistEntries)
    .where(eq(waitlistEntries.id, entryId))
    .limit(1)
    .then((r) => r[0]);

  return c.json(
    {
      success: true,
      data: {
        waitlistEntry: entry,
        message: `You are #${position} on the waitlist`,
      },
    },
    201
  );
});

// Get user's waitlist entries
app.get('/waitlist', async (c) => {
  const db = c.get('db');
  const tenant = c.get('tenant')!;
  const user = c.get('user')!;

  const entries = await db
    .select()
    .from(waitlistEntries)
    .where(and(eq(waitlistEntries.userId, user.sub), eq(waitlistEntries.tenantId, tenant.id)))
    .orderBy(asc(waitlistEntries.createdAt));

  // Get event info
  const eventIds = [...new Set(entries.map((e) => e.eventId))];
  const eventMap = new Map<string, { title: string; startDate: Date }>();

  if (eventIds.length > 0) {
    const eventList = await db
      .select({
        id: events.id,
        title: events.title,
        startDate: events.startDate,
      })
      .from(events)
      .where(eq(events.tenantId, tenant.id));

    for (const event of eventList) {
      eventMap.set(event.id, {
        title: event.title,
        startDate: event.startDate,
      });
    }
  }

  return c.json({
    success: true,
    data: {
      entries: entries.map((e) => ({
        ...e,
        event: eventMap.get(e.eventId),
      })),
    },
  });
});

// Get waitlist for an event (staff only)
app.get('/waitlist/event/:eventId', requireRole('tenant_owner', 'tenant_admin', 'staff'), async (c) => {
  const { eventId } = c.req.param();
  const db = c.get('db');
  const tenant = c.get('tenant')!;

  const entries = await db
    .select()
    .from(waitlistEntries)
    .where(and(eq(waitlistEntries.eventId, eventId), eq(waitlistEntries.tenantId, tenant.id)))
    .orderBy(asc(waitlistEntries.position));

  return c.json({
    success: true,
    data: { entries },
  });
});

// Leave waitlist
app.delete('/waitlist/:entryId', async (c) => {
  const { entryId } = c.req.param();
  const db = c.get('db');
  const tenant = c.get('tenant')!;
  const user = c.get('user')!;

  const entry = await db
    .select()
    .from(waitlistEntries)
    .where(and(eq(waitlistEntries.id, entryId), eq(waitlistEntries.tenantId, tenant.id)))
    .limit(1)
    .then((r) => r[0]);

  if (!entry) {
    throw new NotFoundError('Waitlist entry not found');
  }

  const isStaff = isStaffUser(user, tenant.id);

  if (!isStaff && entry.userId !== user.sub) {
    throw new ForbiddenError('You can only remove your own waitlist entry');
  }

  // Delete the entry
  await db.delete(waitlistEntries).where(eq(waitlistEntries.id, entryId));

  // Reorder remaining entries
  await db.run(sql`
    UPDATE waitlist_entries
    SET position = position - 1
    WHERE event_id = ${entry.eventId}
      AND tenant_id = ${tenant.id}
      AND position > ${entry.position}
  `);

  return c.json({ success: true });
});

export default app;
