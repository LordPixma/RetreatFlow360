/**
 * AI API Routes
 *
 * Provides AI-powered features:
 * - Content generation
 * - Semantic search
 * - AI chatbot
 * - Smart recommendations
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and, isNull } from 'drizzle-orm';
import { ulid } from 'ulid';
import { createDb } from '@retreatflow360/database';
import { events, eventSessions, venues } from '@retreatflow360/database/schema';
import type { Env, Variables } from '@retreatflow360/shared-types';

type AppEnv = { Bindings: Env; Variables: Variables };

const app = new Hono<AppEnv>();

// Validation schemas
const generateDescriptionSchema = z.object({
  title: z.string().min(1),
  type: z.string().min(1),
  duration: z.string().min(1),
  location: z.string().min(1),
  highlights: z.array(z.string()).optional(),
});

const generateEmailSchema = z.object({
  type: z.enum(['reminder', 'confirmation', 'update', 'followup', 'custom']),
  context: z.object({
    eventTitle: z.string().optional(),
    attendeeName: z.string().optional(),
    eventDate: z.string().optional(),
    customPrompt: z.string().optional(),
  }),
  tone: z.enum(['professional', 'friendly', 'casual']).optional(),
});

const generateFaqSchema = z.object({
  question: z.string().min(1),
  eventId: z.string().optional(),
});

const chatSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string(),
    })
  ),
  eventId: z.string().optional(),
});

const searchSchema = z.object({
  query: z.string().min(1),
  type: z.enum(['event', 'session', 'venue', 'faq']).optional(),
  limit: z.number().min(1).max(50).optional(),
});

const insightsSchema = z.object({
  eventId: z.string(),
  type: z.enum(['summary', 'recommendations']),
});

interface AIGatewayOptions {
  tenantId: string;
  subscriptionTier: string;
}

/**
 * Helper to call AI Gateway
 */
async function callAIGateway(
  env: Env,
  endpoint: string,
  body: unknown,
  options: AIGatewayOptions
): Promise<Response> {
  const aiGatewayUrl = env.AI_GATEWAY_URL || 'http://localhost:8788';

  const response = await fetch(`${aiGatewayUrl}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-ID': options.tenantId,
      'X-Subscription-Tier': options.subscriptionTier,
    },
    body: JSON.stringify(body),
  });

  return response;
}

/**
 * Generate event description
 */
app.post(
  '/generate/description',
  zValidator('json', generateDescriptionSchema),
  async (c) => {
    const user = c.get('user');
    const tenant = c.get('tenant');
    if (!user || !tenant) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    // Check if user is staff
    if (!['global_admin', 'tenant_owner', 'tenant_admin', 'staff'].includes(user.role)) {
      return c.json({ error: 'Staff access required' }, 403);
    }

    const data = c.req.valid('json');
    const aiOptions = { tenantId: tenant.id, subscriptionTier: tenant.subscriptionTier };

    try {
      const response = await callAIGateway(c.env, '/generate/event-description', data, aiOptions);

      if (!response.ok) {
        const error = await response.text();
        return c.json({ error: `AI service error: ${error}` }, 500);
      }

      const result = await response.json();
      return c.json(result);
    } catch (error) {
      console.error('AI Gateway error:', error);
      return c.json({ error: 'AI service unavailable' }, 503);
    }
  }
);

/**
 * Generate email content
 */
app.post(
  '/generate/email',
  zValidator('json', generateEmailSchema),
  async (c) => {
    const user = c.get('user');
    const tenant = c.get('tenant');
    if (!user || !tenant) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    // Check if user is staff
    if (!['global_admin', 'tenant_owner', 'tenant_admin', 'staff'].includes(user.role)) {
      return c.json({ error: 'Staff access required' }, 403);
    }

    const data = c.req.valid('json');
    const aiOptions = { tenantId: tenant.id, subscriptionTier: tenant.subscriptionTier };

    try {
      const response = await callAIGateway(c.env, '/generate/email', data, aiOptions);

      if (!response.ok) {
        const error = await response.text();
        return c.json({ error: `AI service error: ${error}` }, 500);
      }

      const result = await response.json();
      return c.json(result);
    } catch (error) {
      console.error('AI Gateway error:', error);
      return c.json({ error: 'AI service unavailable' }, 503);
    }
  }
);

/**
 * Generate FAQ answer
 */
app.post('/generate/faq', zValidator('json', generateFaqSchema), async (c) => {
  const user = c.get('user');
  const tenant = c.get('tenant');
  if (!user || !tenant) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const { question, eventId } = c.req.valid('json');
  const database = createDb(c.env.DB);

  // Get event context if eventId is provided
  let eventContext = {
    title: 'RetreatFlow360 Event',
    description: undefined as string | undefined,
    location: undefined as string | undefined,
    dates: undefined as string | undefined,
  };

  if (eventId) {
    const [event] = await database
      .select()
      .from(events)
      .where(
        and(
          eq(events.id, eventId),
          eq(events.tenantId, tenant.id),
          isNull(events.deletedAt)
        )
      );

    if (event) {
      eventContext = {
        title: event.title,
        description: event.description || undefined,
        location: undefined,
        dates: `${event.startDate.toISOString()} - ${event.endDate.toISOString()}`,
      };

      // Get venue if available
      if (event.venueId) {
        const [venue] = await database
          .select()
          .from(venues)
          .where(eq(venues.id, event.venueId));

        if (venue) {
          eventContext.location = `${venue.name}${venue.city ? `, ${venue.city}` : ''}`;
        }
      }
    }
  }

  const aiOptions = { tenantId: tenant.id, subscriptionTier: tenant.subscriptionTier };

  try {
    const response = await callAIGateway(c.env, '/generate/faq', {
      question,
      eventContext,
    }, aiOptions);

    if (!response.ok) {
      const error = await response.text();
      return c.json({ error: `AI service error: ${error}` }, 500);
    }

    const result = await response.json();
    return c.json(result);
  } catch (error) {
    console.error('AI Gateway error:', error);
    return c.json({ error: 'AI service unavailable' }, 503);
  }
});

/**
 * AI Chatbot
 */
app.post('/chat', zValidator('json', chatSchema), async (c) => {
  const user = c.get('user');
  const tenant = c.get('tenant');
  if (!user || !tenant) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const { messages, eventId } = c.req.valid('json');
  const aiOptions = { tenantId: tenant.id, subscriptionTier: tenant.subscriptionTier };

  try {
    const response = await callAIGateway(c.env, '/chat', {
      messages,
      eventId,
      tenantId: tenant.id,
    }, aiOptions);

    if (!response.ok) {
      const error = await response.text();
      return c.json({ error: `AI service error: ${error}` }, 500);
    }

    const result = await response.json();
    return c.json(result);
  } catch (error) {
    console.error('AI Gateway error:', error);
    return c.json({ error: 'AI service unavailable' }, 503);
  }
});

/**
 * Semantic search
 */
app.post('/search', zValidator('json', searchSchema), async (c) => {
  const user = c.get('user');
  const tenant = c.get('tenant');
  if (!user || !tenant) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const { query, type, limit } = c.req.valid('json');
  const aiOptions = { tenantId: tenant.id, subscriptionTier: tenant.subscriptionTier };

  try {
    const response = await callAIGateway(c.env, '/search', {
      query,
      tenantId: tenant.id,
      type,
      limit,
    }, aiOptions);

    if (!response.ok) {
      const error = await response.text();
      return c.json({ error: `AI service error: ${error}` }, 500);
    }

    const result = await response.json();
    return c.json(result);
  } catch (error) {
    console.error('AI Gateway error:', error);
    return c.json({ error: 'AI service unavailable' }, 503);
  }
});

/**
 * Index event for semantic search
 */
app.post('/index/event/:eventId', async (c) => {
  const user = c.get('user');
  const tenant = c.get('tenant');
  if (!user || !tenant) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  // Check if user is staff
  if (!['global_admin', 'tenant_owner', 'tenant_admin', 'staff'].includes(user.role)) {
    return c.json({ error: 'Staff access required' }, 403);
  }

  const eventId = c.req.param('eventId');
  const database = createDb(c.env.DB);

  // Get event
  const [event] = await database
    .select()
    .from(events)
    .where(
      and(
        eq(events.id, eventId),
        eq(events.tenantId, tenant.id),
        isNull(events.deletedAt)
      )
    );

  if (!event) {
    return c.json({ error: 'Event not found' }, 404);
  }

  // Get venue
  let venueName = '';
  if (event.venueId) {
    const [venue] = await database
      .select()
      .from(venues)
      .where(eq(venues.id, event.venueId));

    if (venue) {
      venueName = venue.name;
    }
  }

  // Get sessions
  const sessions = await database
    .select()
    .from(eventSessions)
    .where(eq(eventSessions.eventId, eventId));

  // Prepare documents for indexing
  const documents = [
    {
      id: `event-${event.id}`,
      content: `${event.title}. ${event.description || ''} ${event.shortDescription || ''} Location: ${venueName}`,
      metadata: {
        eventId: event.id,
        tenantId: tenant.id,
        type: 'event' as const,
        title: event.title,
      },
    },
    ...sessions.map((session) => ({
      id: `session-${session.id}`,
      content: `${session.title}. ${session.description || ''} Type: ${session.sessionType || 'session'}`,
      metadata: {
        eventId: event.id,
        tenantId: tenant.id,
        type: 'session' as const,
        title: session.title,
      },
    })),
  ];

  const aiOptions = { tenantId: tenant.id, subscriptionTier: tenant.subscriptionTier };

  try {
    const response = await callAIGateway(c.env, '/index', { documents }, aiOptions);

    if (!response.ok) {
      const error = await response.text();
      return c.json({ error: `AI service error: ${error}` }, 500);
    }

    const result = await response.json();
    return c.json({
      success: true,
      indexed: documents.length,
      result,
    });
  } catch (error) {
    console.error('AI Gateway error:', error);
    return c.json({ error: 'AI service unavailable' }, 503);
  }
});

/**
 * Generate event insights
 */
app.post('/insights', zValidator('json', insightsSchema), async (c) => {
  const user = c.get('user');
  const tenant = c.get('tenant');
  if (!user || !tenant) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  // Check if user is staff
  if (!['global_admin', 'tenant_owner', 'tenant_admin'].includes(user.role)) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  const { eventId, type } = c.req.valid('json');
  const database = createDb(c.env.DB);

  // Get event
  const [event] = await database
    .select()
    .from(events)
    .where(
      and(
        eq(events.id, eventId),
        eq(events.tenantId, tenant.id),
        isNull(events.deletedAt)
      )
    );

  if (!event) {
    return c.json({ error: 'Event not found' }, 404);
  }

  // TODO: Get actual metrics from database
  const data = {
    eventTitle: event.title,
    totalAttendees: 0, // Would come from bookings count
    registrations: 0, // Would come from bookings count
    revenue: 0, // Would come from payments sum
  };

  const aiOptions = { tenantId: tenant.id, subscriptionTier: tenant.subscriptionTier };

  try {
    const response = await callAIGateway(c.env, '/generate/insights', {
      data,
      type,
    }, aiOptions);

    if (!response.ok) {
      const error = await response.text();
      return c.json({ error: `AI service error: ${error}` }, 500);
    }

    const result = await response.json();
    return c.json(result);
  } catch (error) {
    console.error('AI Gateway error:', error);
    return c.json({ error: 'AI service unavailable' }, 503);
  }
});

export default app;
