import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { logger } from 'hono/logger';
import { requestId } from 'hono/request-id';
import { ulid } from 'ulid';

import type { Env, Variables } from '@retreatflow360/shared-types';
import { createDb } from '@retreatflow360/database';

import { tenantMiddleware } from './middleware/tenant';
import { authMiddleware } from './middleware/auth';
import { errorHandler } from './middleware/error';

import authRoutes from './routes/auth';
import eventsRoutes from './routes/events';
import sessionsRoutes from './routes/sessions';
import venuesRoutes from './routes/venues';
import bookingsRoutes from './routes/bookings';
import uploadsRoutes from './routes/uploads';
import paymentsRoutes from './routes/payments';
import profilesRoutes from './routes/profiles';
import notificationsRoutes from './routes/notifications';
import aiRoutes from './routes/ai';
import adminRoutes from './routes/admin';
import calendarRoutes from './routes/calendar';
import apiKeysRoutes from './routes/api-keys';
import webhooksRoutes from './routes/webhooks';
import publicApiRoutes from './routes/public-api';
import healthRoutes from './routes/health';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Global middleware
app.use('*', logger());
app.use('*', requestId({ generator: () => ulid() }));
app.use('*', secureHeaders());
app.use(
  '*',
  cors({
    origin: (origin) => {
      // Allow localhost in development
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return origin;
      }
      // Allow retreatflow360.com and subdomains
      if (origin.endsWith('.retreatflow360.com') || origin === 'https://retreatflow360.com') {
        return origin;
      }
      return null;
    },
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID', 'X-Request-ID'],
    exposeHeaders: ['X-Request-ID'],
    maxAge: 86400,
  })
);

// Error handler
app.onError(errorHandler);

// Initialize database in context
app.use('*', async (c, next) => {
  const db = createDb(c.env.DB);
  c.set('db', db);
  c.set('requestId', c.get('requestId') || ulid());
  await next();
});

// Health check (no auth required)
app.route('/health', healthRoutes);

// Tenant resolution for API routes
app.use('/api/*', tenantMiddleware);

// Public routes (no auth required)
app.route('/api/v1/auth', authRoutes);

// Public event listing (read-only, no auth)
app.get('/api/v1/public/events', async (c) => {
  // TODO: Implement public event listing
  return c.json({ events: [] });
});

app.get('/api/v1/public/events/:slug', async (c) => {
  // TODO: Implement public event detail
  return c.json({ event: null });
});

// Protected routes (require auth)
app.use('/api/v1/*', authMiddleware);
app.route('/api/v1/events', eventsRoutes);
app.route('/api/v1/events', sessionsRoutes); // Sessions are nested under events: /events/:eventId/sessions
app.route('/api/v1/venues', venuesRoutes);
app.route('/api/v1/bookings', bookingsRoutes);
app.route('/api/v1/uploads', uploadsRoutes);
app.route('/api/v1/payments', paymentsRoutes);
app.route('/api/v1/profiles', profilesRoutes);
app.route('/api/v1/notifications', notificationsRoutes);
app.route('/api/v1/ai', aiRoutes);
app.route('/api/v1/admin', adminRoutes);
app.route('/api/v1/calendar', calendarRoutes);
app.route('/api/v1/api-keys', apiKeysRoutes);
app.route('/api/v1/webhooks', webhooksRoutes);

// Public API (API key auth, not session auth)
app.route('/public/v1', publicApiRoutes);

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'The requested resource was not found',
      },
    },
    404
  );
});

export default app;

// Export types for RPC
export type AppType = typeof app;
