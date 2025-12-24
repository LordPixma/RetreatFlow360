import { Hono } from 'hono';
import type { Env, Variables } from '@retreatflow360/shared-types';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.get('/', async (c) => {
  const start = Date.now();

  // Check D1 connection
  let dbStatus = 'ok';
  try {
    await c.env.DB.prepare('SELECT 1').first();
  } catch {
    dbStatus = 'error';
  }

  // Check KV connection
  let kvStatus = 'ok';
  try {
    await c.env.CACHE.get('health-check');
  } catch {
    kvStatus = 'error';
  }

  const latency = Date.now() - start;

  return c.json({
    status: dbStatus === 'ok' && kvStatus === 'ok' ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    latency: `${latency}ms`,
    services: {
      database: dbStatus,
      cache: kvStatus,
    },
    environment: c.env.ENVIRONMENT,
  });
});

app.get('/ready', async (c) => {
  // Readiness check - can the service handle traffic?
  try {
    await c.env.DB.prepare('SELECT 1').first();
    return c.json({ ready: true });
  } catch {
    return c.json({ ready: false }, 503);
  }
});

app.get('/live', (c) => {
  // Liveness check - is the service running?
  return c.json({ alive: true });
});

export default app;
