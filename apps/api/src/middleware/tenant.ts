import { createMiddleware } from 'hono/factory';
import { eq, isNull, and } from 'drizzle-orm';
import type { Env, Variables } from '@retreatflow360/shared-types';
import { tenants } from '@retreatflow360/database';

/**
 * Extract subdomain from host
 */
function extractSubdomain(host: string): string | null {
  // Remove port if present
  const hostname = host.split(':')[0];
  if (!hostname) return null;

  // Check for localhost
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return null;
  }

  // Split by dots
  const parts = hostname.split('.');

  // Need at least 3 parts for subdomain (e.g., tenant.retreatflow360.com)
  if (parts.length < 3) {
    return null;
  }

  const subdomain = parts[0];

  // Ignore common subdomains
  if (subdomain === 'www' || subdomain === 'app' || subdomain === 'api') {
    return null;
  }

  return subdomain ?? null;
}

export const tenantMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: Variables;
}>(async (c, next) => {
  const db = c.get('db');
  const host = c.req.header('host') || '';

  let tenant: Variables['tenant'] = null;

  // 1. Try subdomain first
  const subdomain = extractSubdomain(host);
  if (subdomain) {
    // Check KV cache first
    const cached = await c.env.CACHE.get(`tenant:slug:${subdomain}`, 'json');
    if (cached) {
      tenant = cached as Variables['tenant'];
    } else {
      // Query database
      const result = await db
        .select({
          id: tenants.id,
          slug: tenants.slug,
          name: tenants.name,
          subscriptionTier: tenants.subscriptionTier,
          featureFlags: tenants.featureFlags,
        })
        .from(tenants)
        .where(and(eq(tenants.slug, subdomain), isNull(tenants.deletedAt)))
        .limit(1);

      if (result[0]) {
        tenant = {
          id: result[0].id,
          slug: result[0].slug,
          name: result[0].name,
          subscriptionTier: result[0].subscriptionTier,
          featureFlags: result[0].featureFlags ?? {},
        };
        // Cache for 5 minutes
        await c.env.CACHE.put(`tenant:slug:${subdomain}`, JSON.stringify(tenant), {
          expirationTtl: 300,
        });
      }
    }
  }

  // 2. Try custom domain lookup
  if (!tenant && !subdomain) {
    const cached = await c.env.CACHE.get(`tenant:domain:${host}`, 'json');
    if (cached) {
      tenant = cached as Variables['tenant'];
    } else {
      const result = await db
        .select({
          id: tenants.id,
          slug: tenants.slug,
          name: tenants.name,
          subscriptionTier: tenants.subscriptionTier,
          featureFlags: tenants.featureFlags,
        })
        .from(tenants)
        .where(and(eq(tenants.customDomain, host), isNull(tenants.deletedAt)))
        .limit(1);

      if (result[0]) {
        tenant = {
          id: result[0].id,
          slug: result[0].slug,
          name: result[0].name,
          subscriptionTier: result[0].subscriptionTier,
          featureFlags: result[0].featureFlags ?? {},
        };
        await c.env.CACHE.put(`tenant:domain:${host}`, JSON.stringify(tenant), {
          expirationTtl: 300,
        });
      }
    }
  }

  // 3. Try X-Tenant-ID header (for API clients)
  if (!tenant) {
    const tenantId = c.req.header('X-Tenant-ID');
    if (tenantId) {
      const cached = await c.env.CACHE.get(`tenant:id:${tenantId}`, 'json');
      if (cached) {
        tenant = cached as Variables['tenant'];
      } else {
        const result = await db
          .select({
            id: tenants.id,
            slug: tenants.slug,
            name: tenants.name,
            subscriptionTier: tenants.subscriptionTier,
            featureFlags: tenants.featureFlags,
          })
          .from(tenants)
          .where(and(eq(tenants.id, tenantId), isNull(tenants.deletedAt)))
          .limit(1);

        if (result[0]) {
          tenant = {
            id: result[0].id,
            slug: result[0].slug,
            name: result[0].name,
            subscriptionTier: result[0].subscriptionTier,
            featureFlags: result[0].featureFlags ?? {},
          };
          await c.env.CACHE.put(`tenant:id:${tenantId}`, JSON.stringify(tenant), {
            expirationTtl: 300,
          });
        }
      }
    }
  }

  // Set tenant in context (can be null for global admin routes)
  c.set('tenant', tenant);

  return next();
});

/**
 * Middleware to require tenant context
 */
export const requireTenant = createMiddleware<{
  Bindings: Env;
  Variables: Variables;
}>(async (c, next) => {
  const tenant = c.get('tenant');

  if (!tenant) {
    return c.json(
      {
        success: false,
        error: {
          code: 'TENANT_REQUIRED',
          message: 'A valid tenant context is required for this request',
        },
      },
      400
    );
  }

  return next();
});
