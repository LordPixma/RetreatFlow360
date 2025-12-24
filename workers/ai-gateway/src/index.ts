/**
 * AI Gateway Worker
 *
 * Provides AI capabilities:
 * - Content generation (event descriptions, emails, FAQs)
 * - Semantic search with Vectorize
 * - AI chatbot with RAG
 * - Smart room allocation recommendations
 * - Per-tenant rate limiting
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';

interface Env {
  AI: Ai;
  VECTORIZE: VectorizeIndex;
  KV: KVNamespace;
  ENVIRONMENT: string;
}

// Rate limits per subscription tier (requests per minute)
const RATE_LIMITS = {
  free: 10,
  starter: 30,
  professional: 100,
  enterprise: 500,
} as const;

type SubscriptionTier = keyof typeof RATE_LIMITS;

// Token limits per request by tier
const TOKEN_LIMITS = {
  free: 300,
  starter: 500,
  professional: 1000,
  enterprise: 2000,
} as const;

interface RateLimitInfo {
  count: number;
  resetAt: number;
}

/**
 * Check if tier is a valid subscription tier
 */
function isValidTier(tier: string): tier is SubscriptionTier {
  return tier in RATE_LIMITS;
}

/**
 * Check and update rate limit for a tenant
 */
async function checkRateLimit(
  kv: KVNamespace,
  tenantId: string,
  tier: string
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const validTier = isValidTier(tier) ? tier : 'free';
  const limit = RATE_LIMITS[validTier];
  const key = `ratelimit:ai:${tenantId}`;
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window

  // Get current rate limit info
  const stored = await kv.get<RateLimitInfo>(key, 'json');

  let info: RateLimitInfo;
  if (!stored || stored.resetAt < now) {
    // Start new window
    info = { count: 1, resetAt: now + windowMs };
  } else {
    // Increment counter
    info = { count: stored.count + 1, resetAt: stored.resetAt };
  }

  // Store updated info
  await kv.put(key, JSON.stringify(info), {
    expirationTtl: 120, // 2 minutes TTL
  });

  const remaining = Math.max(0, limit - info.count);
  return {
    allowed: info.count <= limit,
    remaining,
    resetAt: info.resetAt,
  };
}

/**
 * Get token limit for subscription tier
 */
function getTokenLimit(tier: string): number {
  const validTier = isValidTier(tier) ? tier : 'free';
  return TOKEN_LIMITS[validTier];
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Type for AI text generation response
interface AiTextGenerationResponse {
  response?: string;
}

// Type for AI embedding response
interface AiEmbeddingResponse {
  data: number[][];
}

interface Variables {
  tenantId: string;
  subscriptionTier: string;
  tokenLimit: number;
}

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// CORS middleware
app.use('*', cors());

// Health check (no rate limiting)
app.get('/health', (c) => {
  return c.json({ status: 'ok', service: 'ai-gateway' });
});

// Rate limiting middleware for all AI endpoints
app.use('/generate/*', async (c, next) => {
  const tenantId = c.req.header('x-tenant-id');
  const tier = c.req.header('x-subscription-tier') || 'free';

  if (!tenantId) {
    return c.json({ error: 'Tenant ID required' }, 400);
  }

  const rateLimit = await checkRateLimit(c.env.KV, tenantId, tier);

  // Set rate limit headers
  c.header('X-RateLimit-Remaining', rateLimit.remaining.toString());
  c.header('X-RateLimit-Reset', rateLimit.resetAt.toString());

  if (!rateLimit.allowed) {
    c.header('Retry-After', Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString());
    return c.json(
      { error: 'Rate limit exceeded', retryAfter: rateLimit.resetAt },
      429
    );
  }

  c.set('tenantId', tenantId);
  c.set('subscriptionTier', tier);
  c.set('tokenLimit', getTokenLimit(tier));

  return next();
});

app.use('/chat', async (c, next) => {
  const tenantId = c.req.header('x-tenant-id');
  const tier = c.req.header('x-subscription-tier') || 'free';

  if (!tenantId) {
    return c.json({ error: 'Tenant ID required' }, 400);
  }

  const rateLimit = await checkRateLimit(c.env.KV, tenantId, tier);

  c.header('X-RateLimit-Remaining', rateLimit.remaining.toString());
  c.header('X-RateLimit-Reset', rateLimit.resetAt.toString());

  if (!rateLimit.allowed) {
    c.header('Retry-After', Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString());
    return c.json(
      { error: 'Rate limit exceeded', retryAfter: rateLimit.resetAt },
      429
    );
  }

  c.set('tenantId', tenantId);
  c.set('subscriptionTier', tier);
  c.set('tokenLimit', getTokenLimit(tier));

  return next();
});

app.use('/suggest/*', async (c, next) => {
  const tenantId = c.req.header('x-tenant-id');
  const tier = c.req.header('x-subscription-tier') || 'free';

  if (!tenantId) {
    return c.json({ error: 'Tenant ID required' }, 400);
  }

  const rateLimit = await checkRateLimit(c.env.KV, tenantId, tier);

  c.header('X-RateLimit-Remaining', rateLimit.remaining.toString());
  c.header('X-RateLimit-Reset', rateLimit.resetAt.toString());

  if (!rateLimit.allowed) {
    c.header('Retry-After', Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString());
    return c.json(
      { error: 'Rate limit exceeded', retryAfter: rateLimit.resetAt },
      429
    );
  }

  c.set('tenantId', tenantId);
  c.set('subscriptionTier', tier);
  c.set('tokenLimit', getTokenLimit(tier));

  return next();
});

/**
 * Helper to run text generation
 */
async function runTextGeneration(
  ai: Ai,
  prompt: string,
  options: { max_tokens?: number; temperature?: number } = {}
): Promise<string> {
  const response = await ai.run('@cf/meta/llama-3-8b-instruct' as Parameters<typeof ai.run>[0], {
    prompt,
    max_tokens: options.max_tokens || 500,
    temperature: options.temperature || 0.7,
  });
  return (response as AiTextGenerationResponse).response || '';
}

/**
 * Helper to run chat completion
 */
async function runChatCompletion(
  ai: Ai,
  messages: ChatMessage[],
  options: { max_tokens?: number; temperature?: number } = {}
): Promise<string> {
  const response = await ai.run('@cf/meta/llama-3-8b-instruct' as Parameters<typeof ai.run>[0], {
    messages,
    max_tokens: options.max_tokens || 500,
    temperature: options.temperature || 0.7,
  });
  return (response as AiTextGenerationResponse).response || '';
}

/**
 * Helper to generate embeddings
 */
async function generateEmbedding(ai: Ai, text: string): Promise<number[]> {
  const response = await ai.run('@cf/baai/bge-base-en-v1.5' as Parameters<typeof ai.run>[0], {
    text,
  });
  const embedding = (response as AiEmbeddingResponse).data?.[0];
  if (!embedding) {
    throw new Error('Failed to generate embedding');
  }
  return embedding;
}

/**
 * Generate event description
 */
app.post('/generate/event-description', async (c) => {
  const { title, type, duration, location, highlights } = await c.req.json<{
    title: string;
    type: string;
    duration: string;
    location: string;
    highlights?: string[];
  }>();

  const prompt = `Write a compelling event description for the following retreat:

Title: ${title}
Type: ${type}
Duration: ${duration}
Location: ${location}
${highlights ? `Key Highlights: ${highlights.join(', ')}` : ''}

Write a professional, engaging description that:
1. Captures the essence of the retreat
2. Highlights the unique benefits
3. Creates a sense of excitement
4. Is 2-3 paragraphs long

Description:`;

  const description = await runTextGeneration(c.env.AI, prompt, {
    max_tokens: 500,
    temperature: 0.7,
  });

  return c.json({ description });
});

/**
 * Generate email content
 */
app.post('/generate/email', async (c) => {
  const { type, context, tone } = await c.req.json<{
    type: 'reminder' | 'confirmation' | 'update' | 'followup' | 'custom';
    context: {
      eventTitle?: string;
      attendeeName?: string;
      eventDate?: string;
      customPrompt?: string;
    };
    tone?: 'professional' | 'friendly' | 'casual';
  }>();

  const toneGuide = {
    professional: 'formal and professional',
    friendly: 'warm and friendly',
    casual: 'relaxed and casual',
  };

  const templates: Record<string, string> = {
    reminder: `Write a ${toneGuide[tone || 'friendly']} event reminder email for:
Event: ${context.eventTitle}
Attendee: ${context.attendeeName}
Date: ${context.eventDate}

Include a subject line and email body.`,
    confirmation: `Write a ${toneGuide[tone || 'friendly']} booking confirmation email for:
Event: ${context.eventTitle}
Attendee: ${context.attendeeName}

Include a subject line and email body with next steps.`,
    update: `Write a ${toneGuide[tone || 'friendly']} event update email for:
Event: ${context.eventTitle}

Include a subject line and explain that there are important updates.`,
    followup: `Write a ${toneGuide[tone || 'friendly']} post-event follow-up email for:
Event: ${context.eventTitle}
Attendee: ${context.attendeeName}

Include a subject line, thank them for attending, and ask for feedback.`,
    custom: context.customPrompt || 'Write a professional email.',
  };

  const templatePrompt = templates[type];
  if (!templatePrompt) {
    return c.json({ error: 'Invalid email type' }, 400);
  }

  const content = await runTextGeneration(c.env.AI, templatePrompt, {
    max_tokens: 600,
    temperature: 0.7,
  });

  return c.json({ content });
});

/**
 * Generate FAQ answers
 */
app.post('/generate/faq', async (c) => {
  const { question, eventContext } = await c.req.json<{
    question: string;
    eventContext: {
      title: string;
      description?: string;
      location?: string;
      dates?: string;
      policies?: string[];
    };
  }>();

  const prompt = `You are a helpful assistant for the "${eventContext.title}" event.

Event Details:
- Location: ${eventContext.location || 'To be confirmed'}
- Dates: ${eventContext.dates || 'To be confirmed'}
${eventContext.description ? `- Description: ${eventContext.description}` : ''}
${eventContext.policies?.length ? `- Policies: ${eventContext.policies.join('; ')}` : ''}

Question from attendee: ${question}

Provide a helpful, concise answer based on the event context. If you don't have enough information, say so politely and suggest they contact the organizer.

Answer:`;

  const answer = await runTextGeneration(c.env.AI, prompt, {
    max_tokens: 300,
    temperature: 0.5,
  });

  return c.json({ answer });
});

/**
 * AI Chatbot with RAG context
 */
app.post('/chat', async (c) => {
  const { messages, eventId, tenantId } = await c.req.json<{
    messages: ChatMessage[];
    eventId?: string;
    tenantId: string;
  }>();

  // Get relevant context from Vectorize if eventId is provided
  let contextText = '';
  if (eventId) {
    const lastUserMessage = messages.filter((m) => m.role === 'user').pop();
    if (lastUserMessage) {
      try {
        // Generate embedding for the query
        const embedding = await generateEmbedding(c.env.AI, lastUserMessage.content);

        // Search Vectorize for relevant content
        const results = await c.env.VECTORIZE.query(embedding, {
          topK: 3,
          filter: { eventId, tenantId },
        });

        if (results.matches.length > 0) {
          const contextParts = results.matches
            .filter((m) => m.score > 0.7)
            .map((m) => m.metadata?.content as string)
            .filter(Boolean);

          if (contextParts.length > 0) {
            contextText = `\n\nRelevant Information:\n${contextParts.join('\n\n')}`;
          }
        }
      } catch (error) {
        console.error('Vectorize search error:', error);
      }
    }
  }

  // Build the conversation with system context
  const systemMessage: ChatMessage = {
    role: 'system',
    content: `You are a helpful assistant for RetreatFlow360, a retreat management platform. Help users with questions about events, bookings, and general inquiries. Be friendly, concise, and helpful.${contextText}`,
  };

  const conversation = [systemMessage, ...messages];

  const message = await runChatCompletion(c.env.AI, conversation, {
    max_tokens: 500,
    temperature: 0.7,
  });

  return c.json({ message });
});

/**
 * Index content for semantic search
 */
app.post('/index', async (c) => {
  const { documents } = await c.req.json<{
    documents: Array<{
      id: string;
      content: string;
      metadata: {
        eventId: string;
        tenantId: string;
        type: 'event' | 'session' | 'venue' | 'faq';
        title?: string;
      };
    }>;
  }>();

  const results: Array<{ id: string; success: boolean; error?: string }> = [];

  for (const doc of documents) {
    try {
      // Generate embedding
      const embedding = await generateEmbedding(c.env.AI, doc.content);

      // Insert into Vectorize
      await c.env.VECTORIZE.upsert([
        {
          id: doc.id,
          values: embedding,
          metadata: {
            ...doc.metadata,
            content: doc.content.substring(0, 1000), // Store truncated content
          },
        },
      ]);

      results.push({ id: doc.id, success: true });
    } catch (error) {
      results.push({
        id: doc.id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return c.json({ results });
});

/**
 * Semantic search for events
 */
app.post('/search', async (c) => {
  const { query, tenantId, type, limit } = await c.req.json<{
    query: string;
    tenantId: string;
    type?: 'event' | 'session' | 'venue' | 'faq';
    limit?: number;
  }>();

  // Generate embedding for the query
  const embedding = await generateEmbedding(c.env.AI, query);

  // Build filter
  const filter: Record<string, string> = { tenantId };
  if (type) {
    filter.type = type;
  }

  // Search Vectorize
  const results = await c.env.VECTORIZE.query(embedding, {
    topK: limit || 10,
    filter,
  });

  return c.json({
    results: results.matches.map((match) => ({
      id: match.id,
      score: match.score,
      metadata: match.metadata,
    })),
  });
});

/**
 * Smart room allocation suggestions
 */
app.post('/suggest/room-allocation', async (c) => {
  const { attendees, rooms, eventType } = await c.req.json<{
    attendees: Array<{
      id: string;
      name: string;
      accessibilityNeeds?: string[];
      preferences?: string[];
      groupWith?: string[];
    }>;
    rooms: Array<{
      id: string;
      name: string;
      capacity: number;
      floor: number;
      accessibilityFeatures?: string[];
      amenities?: string[];
    }>;
    eventType?: string;
  }>();

  const prompt = `You are a room allocation assistant. Given the following attendees and rooms, suggest optimal room assignments.

Event Type: ${eventType || 'General Retreat'}

Attendees:
${attendees.map((a) => `- ${a.name}${a.accessibilityNeeds?.length ? ` (Needs: ${a.accessibilityNeeds.join(', ')})` : ''}${a.preferences?.length ? ` (Prefers: ${a.preferences.join(', ')})` : ''}${a.groupWith?.length ? ` (Group with: ${a.groupWith.join(', ')})` : ''}`).join('\n')}

Available Rooms:
${rooms.map((r) => `- ${r.name} (Capacity: ${r.capacity}, Floor: ${r.floor})${r.accessibilityFeatures?.length ? ` [Accessible: ${r.accessibilityFeatures.join(', ')}]` : ''}${r.amenities?.length ? ` [Amenities: ${r.amenities.join(', ')}]` : ''}`).join('\n')}

Provide room assignment suggestions in JSON format:
{
  "assignments": [
    {"attendeeId": "...", "roomId": "...", "reason": "..."},
    ...
  ],
  "notes": "Any overall considerations or warnings"
}

Suggestions:`;

  const responseText = await runTextGeneration(c.env.AI, prompt, {
    max_tokens: 800,
    temperature: 0.3,
  });

  // Try to parse JSON from response
  let suggestions;
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      suggestions = JSON.parse(jsonMatch[0]);
    }
  } catch {
    suggestions = { raw: responseText };
  }

  return c.json({ suggestions });
});

/**
 * Generate summary/insights for event analytics
 */
app.post('/generate/insights', async (c) => {
  const { data, type } = await c.req.json<{
    data: {
      eventTitle: string;
      totalAttendees: number;
      registrations: number;
      revenue: number;
      dietaryBreakdown?: Record<string, number>;
      accessibilityNeeds?: Record<string, number>;
      feedbackSummary?: string;
    };
    type: 'summary' | 'recommendations';
  }>();

  const prompts = {
    summary: `Analyze the following event data and provide a concise executive summary:

Event: ${data.eventTitle}
Total Attendees: ${data.totalAttendees}
Registrations: ${data.registrations}
Revenue: $${data.revenue}
${data.dietaryBreakdown ? `Dietary Requirements: ${JSON.stringify(data.dietaryBreakdown)}` : ''}
${data.accessibilityNeeds ? `Accessibility Needs: ${JSON.stringify(data.accessibilityNeeds)}` : ''}
${data.feedbackSummary ? `Feedback Summary: ${data.feedbackSummary}` : ''}

Provide a 3-5 sentence executive summary highlighting key metrics and insights.`,
    recommendations: `Based on the following event data, provide actionable recommendations for future events:

Event: ${data.eventTitle}
Total Attendees: ${data.totalAttendees}
Registrations: ${data.registrations}
Revenue: $${data.revenue}
${data.dietaryBreakdown ? `Dietary Requirements: ${JSON.stringify(data.dietaryBreakdown)}` : ''}
${data.accessibilityNeeds ? `Accessibility Needs: ${JSON.stringify(data.accessibilityNeeds)}` : ''}
${data.feedbackSummary ? `Feedback Summary: ${data.feedbackSummary}` : ''}

Provide 3-5 specific, actionable recommendations to improve future events.`,
  };

  const result = await runTextGeneration(c.env.AI, prompts[type], {
    max_tokens: 400,
    temperature: 0.6,
  });

  return c.json({ [type]: result });
});

export default app;
