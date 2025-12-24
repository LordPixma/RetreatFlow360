/**
 * Calendar API Routes
 *
 * Provides calendar integration:
 * - iCal feed for events
 * - Single event iCal download
 * - Calendar subscription URL
 */

import { Hono } from 'hono';
import { eq, and, gte, isNull } from 'drizzle-orm';
import { createDb } from '@retreatflow360/database';
import { events, bookings, eventSessions, venues } from '@retreatflow360/database/schema';
import type { Env, Variables } from '@retreatflow360/shared-types';

type AppEnv = { Bindings: Env; Variables: Variables };

const app = new Hono<AppEnv>();

/**
 * Generate iCal formatted date
 */
function formatICalDate(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

/**
 * Escape special characters for iCal
 */
function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Generate unique ID for iCal event
 */
function generateUID(id: string, domain: string): string {
  return `${id}@${domain}`;
}

/**
 * Build iCal VEVENT component
 */
function buildVEvent(params: {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  dtstart: Date;
  dtend: Date;
  url?: string;
  created?: Date;
  lastModified?: Date;
}): string {
  const lines: string[] = [
    'BEGIN:VEVENT',
    `UID:${params.uid}`,
    `DTSTAMP:${formatICalDate(new Date())}`,
    `DTSTART:${formatICalDate(params.dtstart)}`,
    `DTEND:${formatICalDate(params.dtend)}`,
    `SUMMARY:${escapeICalText(params.summary)}`,
  ];

  if (params.description) {
    lines.push(`DESCRIPTION:${escapeICalText(params.description)}`);
  }

  if (params.location) {
    lines.push(`LOCATION:${escapeICalText(params.location)}`);
  }

  if (params.url) {
    lines.push(`URL:${params.url}`);
  }

  if (params.created) {
    lines.push(`CREATED:${formatICalDate(params.created)}`);
  }

  if (params.lastModified) {
    lines.push(`LAST-MODIFIED:${formatICalDate(params.lastModified)}`);
  }

  lines.push('END:VEVENT');

  return lines.join('\r\n');
}

/**
 * Build complete iCal file
 */
function buildICalFile(calendarName: string, events: string[]): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//RetreatFlow360//Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeICalText(calendarName)}`,
    ...events,
    'END:VCALENDAR',
  ];

  return lines.join('\r\n');
}

/**
 * Get iCal feed for user's bookings
 */
app.get('/feed', async (c) => {
  const user = c.get('user');
  const tenant = c.get('tenant');
  if (!user || !tenant) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const database = createDb(c.env.DB);

  // Get user's confirmed bookings with event details
  const userBookings = await database
    .select({
      bookingId: bookings.id,
      eventId: events.id,
      eventTitle: events.title,
      eventDescription: events.description,
      startDate: events.startDate,
      endDate: events.endDate,
      venueId: events.venueId,
      eventSlug: events.slug,
      createdAt: events.createdAt,
      updatedAt: events.updatedAt,
    })
    .from(bookings)
    .innerJoin(events, eq(bookings.eventId, events.id))
    .where(
      and(
        eq(bookings.userId, user.sub),
        eq(bookings.tenantId, tenant.id),
        eq(bookings.status, 'confirmed'),
        isNull(events.deletedAt)
      )
    );

  // Build iCal events
  const icalEvents: string[] = [];
  const domain = 'retreatflow360.com';

  for (const booking of userBookings) {
    // Get venue if available
    let location = '';
    if (booking.venueId) {
      const [venue] = await database
        .select({ name: venues.name, city: venues.city, country: venues.country })
        .from(venues)
        .where(eq(venues.id, booking.venueId));

      if (venue) {
        location = [venue.name, venue.city, venue.country].filter(Boolean).join(', ');
      }
    }

    icalEvents.push(
      buildVEvent({
        uid: generateUID(booking.eventId, domain),
        summary: booking.eventTitle,
        description: booking.eventDescription || undefined,
        location: location || undefined,
        dtstart: booking.startDate,
        dtend: booking.endDate,
        url: `https://${tenant.slug}.${domain}/events/${booking.eventSlug}`,
        created: booking.createdAt,
        lastModified: booking.updatedAt,
      })
    );
  }

  const icalContent = buildICalFile(`My Events - ${tenant.name}`, icalEvents);

  return new Response(icalContent, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="my-events.ics"',
    },
  });
});

/**
 * Get iCal for a single event
 */
app.get('/event/:eventId', async (c) => {
  const tenant = c.get('tenant');
  if (!tenant) {
    return c.json({ error: 'Tenant required' }, 400);
  }

  const eventId = c.req.param('eventId');
  const database = createDb(c.env.DB);

  // Get event details
  const [event] = await database
    .select()
    .from(events)
    .where(
      and(
        eq(events.id, eventId),
        eq(events.tenantId, tenant.id),
        eq(events.status, 'published'),
        isNull(events.deletedAt)
      )
    );

  if (!event) {
    return c.json({ error: 'Event not found' }, 404);
  }

  // Get venue if available
  let location = '';
  if (event.venueId) {
    const [venue] = await database
      .select({ name: venues.name, city: venues.city, country: venues.country })
      .from(venues)
      .where(eq(venues.id, event.venueId));

    if (venue) {
      location = [venue.name, venue.city, venue.country].filter(Boolean).join(', ');
    }
  }

  const domain = 'retreatflow360.com';
  const icalEvent = buildVEvent({
    uid: generateUID(event.id, domain),
    summary: event.title,
    description: event.description || undefined,
    location: location || undefined,
    dtstart: event.startDate,
    dtend: event.endDate,
    url: `https://${tenant.slug}.${domain}/events/${event.slug}`,
    created: event.createdAt,
    lastModified: event.updatedAt,
  });

  const icalContent = buildICalFile(event.title, [icalEvent]);

  return new Response(icalContent, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${event.slug}.ics"`,
    },
  });
});

/**
 * Get iCal for event sessions
 */
app.get('/event/:eventId/sessions', async (c) => {
  const tenant = c.get('tenant');
  if (!tenant) {
    return c.json({ error: 'Tenant required' }, 400);
  }

  const eventId = c.req.param('eventId');
  const database = createDb(c.env.DB);

  // Get event details
  const [event] = await database
    .select()
    .from(events)
    .where(
      and(
        eq(events.id, eventId),
        eq(events.tenantId, tenant.id),
        eq(events.status, 'published'),
        isNull(events.deletedAt)
      )
    );

  if (!event) {
    return c.json({ error: 'Event not found' }, 404);
  }

  // Get sessions
  const sessions = await database
    .select()
    .from(eventSessions)
    .where(eq(eventSessions.eventId, eventId));

  // Get venue for location
  let location = '';
  if (event.venueId) {
    const [venue] = await database
      .select({ name: venues.name, city: venues.city, country: venues.country })
      .from(venues)
      .where(eq(venues.id, event.venueId));

    if (venue) {
      location = [venue.name, venue.city, venue.country].filter(Boolean).join(', ');
    }
  }

  const domain = 'retreatflow360.com';
  const icalEvents: string[] = [];

  for (const session of sessions) {
    icalEvents.push(
      buildVEvent({
        uid: generateUID(session.id, domain),
        summary: `${event.title}: ${session.title}`,
        description: session.description || undefined,
        location: location || undefined,
        dtstart: session.startTime,
        dtend: session.endTime,
        url: `https://${tenant.slug}.${domain}/events/${event.slug}`,
        created: session.createdAt,
        // Sessions don't have updatedAt, use createdAt as fallback
        lastModified: session.createdAt,
      })
    );
  }

  const icalContent = buildICalFile(`${event.title} - Sessions`, icalEvents);

  return new Response(icalContent, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${event.slug}-sessions.ics"`,
    },
  });
});

/**
 * Get calendar subscription URL
 */
app.get('/subscription-url', async (c) => {
  const user = c.get('user');
  const tenant = c.get('tenant');
  if (!user || !tenant) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  // Generate a unique token for this user's calendar feed
  const token = await generateCalendarToken(c.env.KV, user.sub, tenant.id);

  const baseUrl = c.env.API_BASE_URL || 'https://api.retreatflow360.com';
  const subscriptionUrl = `${baseUrl}/api/v1/calendar/subscribe/${token}`;

  return c.json({
    subscriptionUrl,
    webcalUrl: subscriptionUrl.replace('https://', 'webcal://'),
  });
});

/**
 * Calendar subscription feed (public with token)
 */
app.get('/subscribe/:token', async (c) => {
  const token = c.req.param('token');

  // Validate token and get user/tenant
  const tokenData = await c.env.KV.get<{ userId: string; tenantId: string }>(
    `calendar-token:${token}`,
    'json'
  );

  if (!tokenData) {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }

  const database = createDb(c.env.DB);

  // Get user's confirmed bookings with event details
  const userBookings = await database
    .select({
      bookingId: bookings.id,
      eventId: events.id,
      eventTitle: events.title,
      eventDescription: events.description,
      startDate: events.startDate,
      endDate: events.endDate,
      venueId: events.venueId,
      eventSlug: events.slug,
      tenantSlug: events.tenantId,
      createdAt: events.createdAt,
      updatedAt: events.updatedAt,
    })
    .from(bookings)
    .innerJoin(events, eq(bookings.eventId, events.id))
    .where(
      and(
        eq(bookings.userId, tokenData.userId),
        eq(bookings.tenantId, tokenData.tenantId),
        eq(bookings.status, 'confirmed'),
        isNull(events.deletedAt)
      )
    );

  // Build iCal events
  const icalEvents: string[] = [];
  const domain = 'retreatflow360.com';

  for (const booking of userBookings) {
    icalEvents.push(
      buildVEvent({
        uid: generateUID(booking.eventId, domain),
        summary: booking.eventTitle,
        description: booking.eventDescription || undefined,
        dtstart: booking.startDate,
        dtend: booking.endDate,
        created: booking.createdAt,
        lastModified: booking.updatedAt,
      })
    );
  }

  const icalContent = buildICalFile('My RetreatFlow360 Events', icalEvents);

  return new Response(icalContent, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': 'max-age=3600', // Cache for 1 hour
    },
  });
});

/**
 * Generate or retrieve calendar subscription token
 */
async function generateCalendarToken(
  kv: KVNamespace,
  userId: string,
  tenantId: string
): Promise<string> {
  // Check for existing token
  const existingToken = await kv.get(`calendar-user:${userId}:${tenantId}`);
  if (existingToken) {
    return existingToken;
  }

  // Generate new token
  const token = crypto.randomUUID();

  // Store token -> user mapping
  await kv.put(
    `calendar-token:${token}`,
    JSON.stringify({ userId, tenantId }),
    { expirationTtl: 60 * 60 * 24 * 365 } // 1 year
  );

  // Store user -> token mapping
  await kv.put(`calendar-user:${userId}:${tenantId}`, token, {
    expirationTtl: 60 * 60 * 24 * 365, // 1 year
  });

  return token;
}

export default app;
