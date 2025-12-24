/**
 * Public API Routes
 *
 * RESTful API for external integrations with API key authentication.
 * Provides read access to events, venues, and bookings.
 */

import { Hono } from 'hono';
import { eq, and, isNull, gte, lte, desc } from 'drizzle-orm';
import { createDb } from '@retreatflow360/database';
import {
  events,
  venues,
  eventSessions,
  bookings,
  apiKeys,
} from '@retreatflow360/database/schema';
import type { Env, Variables } from '@retreatflow360/shared-types';

type AppEnv = { Bindings: Env; Variables: Variables };

const app = new Hono<AppEnv>();

/**
 * API Key authentication middleware
 */
async function apiKeyAuth(c: { env: Env; req: { header: (name: string) => string | undefined } }) {
  const authHeader = c.req.header('Authorization');
  const apiKeyHeader = c.req.header('X-API-Key');

  const key = apiKeyHeader || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null);

  if (!key) {
    return { error: 'API key required', status: 401 as const };
  }

  // Extract prefix (first 8 chars)
  const prefix = key.substring(0, 8);

  const database = createDb(c.env.DB);

  // Find API key by prefix
  const [apiKeyRecord] = await database
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.keyPrefix, prefix), eq(apiKeys.isActive, true)));

  if (!apiKeyRecord) {
    return { error: 'Invalid API key', status: 401 as const };
  }

  // Check expiration
  if (apiKeyRecord.expiresAt && apiKeyRecord.expiresAt < new Date()) {
    return { error: 'API key expired', status: 401 as const };
  }

  // Verify key hash
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  if (hashHex !== apiKeyRecord.keyHash) {
    return { error: 'Invalid API key', status: 401 as const };
  }

  // Check rate limit
  const rateLimitKey = `api-rate:${apiKeyRecord.id}`;
  const currentCount = await c.env.KV.get<number>(rateLimitKey, 'json');
  const limit = apiKeyRecord.rateLimit || 1000;

  if (currentCount && currentCount >= limit) {
    return { error: 'Rate limit exceeded', status: 429 as const };
  }

  // Increment rate limit counter
  await c.env.KV.put(rateLimitKey, JSON.stringify((currentCount || 0) + 1), {
    expirationTtl: 3600, // 1 hour
  });

  // Update last used
  await database
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, apiKeyRecord.id));

  return { apiKey: apiKeyRecord };
}

/**
 * OpenAPI specification
 */
app.get('/openapi.json', (c) => {
  const spec = {
    openapi: '3.0.3',
    info: {
      title: 'RetreatFlow360 Public API',
      description: 'API for integrating with RetreatFlow360 retreat management platform',
      version: '1.0.0',
      contact: {
        name: 'RetreatFlow360 Support',
        email: 'api@retreatflow360.com',
      },
    },
    servers: [
      {
        url: 'https://api.retreatflow360.com/public/v1',
        description: 'Production server',
      },
    ],
    security: [{ apiKey: [] }],
    components: {
      securitySchemes: {
        apiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API key for authentication',
        },
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          description: 'Bearer token (API key)',
        },
      },
      schemas: {
        Event: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            slug: { type: 'string' },
            description: { type: 'string', nullable: true },
            shortDescription: { type: 'string', nullable: true },
            startDate: { type: 'string', format: 'date-time' },
            endDate: { type: 'string', format: 'date-time' },
            timezone: { type: 'string' },
            maxAttendees: { type: 'integer', nullable: true },
            status: { type: 'string', enum: ['draft', 'published', 'cancelled', 'completed'] },
            visibility: { type: 'string', enum: ['public', 'private', 'unlisted'] },
            venue: { $ref: '#/components/schemas/Venue' },
            pricingTiers: {
              type: 'array',
              items: { $ref: '#/components/schemas/PricingTier' },
            },
          },
        },
        Venue: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string', nullable: true },
            address: { type: 'string', nullable: true },
            city: { type: 'string', nullable: true },
            country: { type: 'string', nullable: true },
            capacity: { type: 'integer', nullable: true },
            amenities: { type: 'array', items: { type: 'string' } },
          },
        },
        Session: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string', nullable: true },
            startTime: { type: 'string', format: 'date-time' },
            endTime: { type: 'string', format: 'date-time' },
            sessionType: { type: 'string', nullable: true },
            maxParticipants: { type: 'integer', nullable: true },
          },
        },
        PricingTier: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            price: { type: 'number' },
            currency: { type: 'string' },
            description: { type: 'string', nullable: true },
          },
        },
        Booking: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            eventId: { type: 'string' },
            status: { type: 'string', enum: ['pending', 'confirmed', 'cancelled', 'refunded', 'waitlisted'] },
            pricingTier: { type: 'string' },
            baseAmount: { type: 'number' },
            currency: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            code: { type: 'string' },
          },
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            data: { type: 'array' },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'integer' },
                limit: { type: 'integer' },
                total: { type: 'integer' },
                hasMore: { type: 'boolean' },
              },
            },
          },
        },
      },
    },
    paths: {
      '/events': {
        get: {
          summary: 'List events',
          description: 'Get a paginated list of published events',
          tags: ['Events'],
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
            { name: 'from', in: 'query', schema: { type: 'string', format: 'date' } },
            { name: 'to', in: 'query', schema: { type: 'string', format: 'date' } },
            { name: 'status', in: 'query', schema: { type: 'string', enum: ['published', 'completed'] } },
          ],
          responses: {
            200: {
              description: 'List of events',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } },
            },
            401: { description: 'Unauthorized' },
            429: { description: 'Rate limit exceeded' },
          },
        },
      },
      '/events/{eventId}': {
        get: {
          summary: 'Get event details',
          tags: ['Events'],
          parameters: [{ name: 'eventId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Event details', content: { 'application/json': { schema: { $ref: '#/components/schemas/Event' } } } },
            404: { description: 'Event not found' },
          },
        },
      },
      '/events/{eventId}/sessions': {
        get: {
          summary: 'Get event sessions',
          tags: ['Events'],
          parameters: [{ name: 'eventId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'List of sessions' },
            404: { description: 'Event not found' },
          },
        },
      },
      '/venues': {
        get: {
          summary: 'List venues',
          tags: ['Venues'],
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          ],
          responses: {
            200: { description: 'List of venues' },
          },
        },
      },
      '/venues/{venueId}': {
        get: {
          summary: 'Get venue details',
          tags: ['Venues'],
          parameters: [{ name: 'venueId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Venue details' },
            404: { description: 'Venue not found' },
          },
        },
      },
      '/bookings': {
        get: {
          summary: 'List bookings',
          description: 'Get bookings (requires bookings:read scope)',
          tags: ['Bookings'],
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
            { name: 'eventId', in: 'query', schema: { type: 'string' } },
            { name: 'status', in: 'query', schema: { type: 'string' } },
          ],
          responses: {
            200: { description: 'List of bookings' },
            403: { description: 'Insufficient scope' },
          },
        },
      },
    },
  };

  return c.json(spec);
});

/**
 * List events
 */
app.get('/events', async (c) => {
  const auth = await apiKeyAuth(c);
  if ('error' in auth) {
    return c.json({ error: auth.error }, auth.status);
  }

  if (!auth.apiKey.scopes.includes('events:read')) {
    return c.json({ error: 'Insufficient scope: events:read required' }, 403);
  }

  const database = createDb(c.env.DB);
  const page = parseInt(c.req.query('page') || '1');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
  const offset = (page - 1) * limit;

  const from = c.req.query('from');
  const to = c.req.query('to');

  // Build conditions
  const conditions = [
    eq(events.tenantId, auth.apiKey.tenantId),
    eq(events.status, 'published'),
    isNull(events.deletedAt),
  ];

  if (from) {
    conditions.push(gte(events.startDate, new Date(from)));
  }
  if (to) {
    conditions.push(lte(events.endDate, new Date(to)));
  }

  const eventList = await database
    .select({
      id: events.id,
      title: events.title,
      slug: events.slug,
      description: events.description,
      shortDescription: events.shortDescription,
      startDate: events.startDate,
      endDate: events.endDate,
      timezone: events.timezone,
      maxAttendees: events.maxAttendees,
      status: events.status,
      visibility: events.visibility,
      pricingTiers: events.pricingTiers,
      venueId: events.venueId,
    })
    .from(events)
    .where(and(...conditions))
    .orderBy(desc(events.startDate))
    .limit(limit)
    .offset(offset);

  // Get venue details for events
  const eventsWithVenues = await Promise.all(
    eventList.map(async (event) => {
      let venue = null;
      if (event.venueId) {
        const [venueData] = await database
          .select({
            id: venues.id,
            name: venues.name,
            city: venues.city,
            country: venues.country,
          })
          .from(venues)
          .where(eq(venues.id, event.venueId));
        venue = venueData || null;
      }
      return { ...event, venue };
    })
  );

  return c.json({
    data: eventsWithVenues,
    pagination: {
      page,
      limit,
      hasMore: eventList.length === limit,
    },
  });
});

/**
 * Get event by ID
 */
app.get('/events/:eventId', async (c) => {
  const auth = await apiKeyAuth(c);
  if ('error' in auth) {
    return c.json({ error: auth.error }, auth.status);
  }

  if (!auth.apiKey.scopes.includes('events:read')) {
    return c.json({ error: 'Insufficient scope: events:read required' }, 403);
  }

  const eventId = c.req.param('eventId');
  const database = createDb(c.env.DB);

  const [event] = await database
    .select()
    .from(events)
    .where(
      and(
        eq(events.id, eventId),
        eq(events.tenantId, auth.apiKey.tenantId),
        eq(events.status, 'published'),
        isNull(events.deletedAt)
      )
    );

  if (!event) {
    return c.json({ error: 'Event not found' }, 404);
  }

  // Get venue
  let venue = null;
  if (event.venueId) {
    const [venueData] = await database
      .select()
      .from(venues)
      .where(eq(venues.id, event.venueId));
    venue = venueData || null;
  }

  // Get sessions
  const sessions = await database
    .select({
      id: eventSessions.id,
      title: eventSessions.title,
      description: eventSessions.description,
      startTime: eventSessions.startTime,
      endTime: eventSessions.endTime,
      sessionType: eventSessions.sessionType,
      maxParticipants: eventSessions.maxParticipants,
    })
    .from(eventSessions)
    .where(eq(eventSessions.eventId, eventId));

  return c.json({
    ...event,
    venue,
    sessions,
  });
});

/**
 * Get event sessions
 */
app.get('/events/:eventId/sessions', async (c) => {
  const auth = await apiKeyAuth(c);
  if ('error' in auth) {
    return c.json({ error: auth.error }, auth.status);
  }

  if (!auth.apiKey.scopes.includes('events:read')) {
    return c.json({ error: 'Insufficient scope: events:read required' }, 403);
  }

  const eventId = c.req.param('eventId');
  const database = createDb(c.env.DB);

  // Verify event exists and belongs to tenant
  const [event] = await database
    .select({ id: events.id })
    .from(events)
    .where(
      and(
        eq(events.id, eventId),
        eq(events.tenantId, auth.apiKey.tenantId),
        isNull(events.deletedAt)
      )
    );

  if (!event) {
    return c.json({ error: 'Event not found' }, 404);
  }

  const sessions = await database
    .select({
      id: eventSessions.id,
      title: eventSessions.title,
      description: eventSessions.description,
      startTime: eventSessions.startTime,
      endTime: eventSessions.endTime,
      sessionType: eventSessions.sessionType,
      maxParticipants: eventSessions.maxParticipants,
    })
    .from(eventSessions)
    .where(eq(eventSessions.eventId, eventId));

  return c.json({ data: sessions });
});

/**
 * List venues
 */
app.get('/venues', async (c) => {
  const auth = await apiKeyAuth(c);
  if ('error' in auth) {
    return c.json({ error: auth.error }, auth.status);
  }

  if (!auth.apiKey.scopes.includes('venues:read') && !auth.apiKey.scopes.includes('events:read')) {
    return c.json({ error: 'Insufficient scope' }, 403);
  }

  const database = createDb(c.env.DB);
  const page = parseInt(c.req.query('page') || '1');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
  const offset = (page - 1) * limit;

  const venueList = await database
    .select({
      id: venues.id,
      name: venues.name,
      description: venues.description,
      address: venues.address,
      city: venues.city,
      country: venues.country,
      capacity: venues.capacity,
      amenities: venues.amenities,
    })
    .from(venues)
    .where(and(eq(venues.tenantId, auth.apiKey.tenantId), isNull(venues.deletedAt)))
    .limit(limit)
    .offset(offset);

  return c.json({
    data: venueList,
    pagination: {
      page,
      limit,
      hasMore: venueList.length === limit,
    },
  });
});

/**
 * Get venue by ID
 */
app.get('/venues/:venueId', async (c) => {
  const auth = await apiKeyAuth(c);
  if ('error' in auth) {
    return c.json({ error: auth.error }, auth.status);
  }

  if (!auth.apiKey.scopes.includes('venues:read') && !auth.apiKey.scopes.includes('events:read')) {
    return c.json({ error: 'Insufficient scope' }, 403);
  }

  const venueId = c.req.param('venueId');
  const database = createDb(c.env.DB);

  const [venue] = await database
    .select()
    .from(venues)
    .where(
      and(
        eq(venues.id, venueId),
        eq(venues.tenantId, auth.apiKey.tenantId),
        isNull(venues.deletedAt)
      )
    );

  if (!venue) {
    return c.json({ error: 'Venue not found' }, 404);
  }

  return c.json(venue);
});

/**
 * List bookings
 */
app.get('/bookings', async (c) => {
  const auth = await apiKeyAuth(c);
  if ('error' in auth) {
    return c.json({ error: auth.error }, auth.status);
  }

  if (!auth.apiKey.scopes.includes('bookings:read')) {
    return c.json({ error: 'Insufficient scope: bookings:read required' }, 403);
  }

  const database = createDb(c.env.DB);
  const page = parseInt(c.req.query('page') || '1');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
  const offset = (page - 1) * limit;

  const eventId = c.req.query('eventId');
  const status = c.req.query('status');

  const conditions = [eq(bookings.tenantId, auth.apiKey.tenantId)];

  if (eventId) {
    conditions.push(eq(bookings.eventId, eventId));
  }
  if (status) {
    conditions.push(eq(bookings.status, status as 'pending' | 'confirmed' | 'cancelled' | 'refunded' | 'waitlisted'));
  }

  const bookingList = await database
    .select({
      id: bookings.id,
      eventId: bookings.eventId,
      status: bookings.status,
      pricingTier: bookings.pricingTier,
      baseAmount: bookings.baseAmount,
      currency: bookings.currency,
      createdAt: bookings.createdAt,
    })
    .from(bookings)
    .where(and(...conditions))
    .orderBy(desc(bookings.createdAt))
    .limit(limit)
    .offset(offset);

  return c.json({
    data: bookingList,
    pagination: {
      page,
      limit,
      hasMore: bookingList.length === limit,
    },
  });
});

export default app;
