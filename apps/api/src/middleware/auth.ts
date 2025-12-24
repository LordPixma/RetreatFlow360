import { createMiddleware } from 'hono/factory';
import { eq, and, isNull } from 'drizzle-orm';
import type { Env, Variables } from '@retreatflow360/shared-types';
import { users, userTenantMemberships } from '@retreatflow360/database';

interface JWTPayload {
  sub: string; // user id
  email: string;
  role: string;
  iat: number;
  exp: number;
  iss: string;
}

/**
 * Verify JWT token
 */
async function verifyToken(token: string, secret: string): Promise<JWTPayload | null> {
  try {
    const [headerB64, payloadB64, signatureB64] = token.split('.');
    if (!headerB64 || !payloadB64 || !signatureB64) {
      return null;
    }

    // Verify signature using Web Crypto API
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signatureData = Uint8Array.from(atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/')), (c) =>
      c.charCodeAt(0)
    );
    const dataToVerify = encoder.encode(`${headerB64}.${payloadB64}`);

    const isValid = await crypto.subtle.verify('HMAC', key, signatureData, dataToVerify);
    if (!isValid) {
      return null;
    }

    // Decode payload
    const payloadJson = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(payloadJson) as JWTPayload;

    // Check expiration
    if (payload.exp * 1000 < Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export const authMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: Variables;
}>(async (c, next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing or invalid authorization header',
        },
      },
      401
    );
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload) {
    return c.json(
      {
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired access token',
        },
      },
      401
    );
  }

  // Verify issuer
  if (payload.iss !== c.env.JWT_ISSUER) {
    return c.json(
      {
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid token issuer',
        },
      },
      401
    );
  }

  // Get user's tenant memberships
  const db = c.get('db');
  const memberships = await db
    .select({
      tenantId: userTenantMemberships.tenantId,
      role: userTenantMemberships.role,
      permissions: userTenantMemberships.permissions,
    })
    .from(userTenantMemberships)
    .where(eq(userTenantMemberships.userId, payload.sub));

  c.set('user', {
    sub: payload.sub,
    email: payload.email,
    role: payload.role,
    tenantMemberships: memberships.map((m) => ({
      tenantId: m.tenantId,
      role: m.role,
      permissions: (m.permissions as Record<string, boolean>) ?? {},
    })),
  });

  return next();
});

/**
 * Middleware to require specific roles
 */
export function requireRole(...roles: string[]) {
  return createMiddleware<{
    Bindings: Env;
    Variables: Variables;
  }>(async (c, next) => {
    const user = c.get('user');

    if (!user) {
      return c.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        },
        401
      );
    }

    // Global admin has access to everything
    if (user.role === 'global_admin') {
      return next();
    }

    // Check if user has required role
    if (!roles.includes(user.role)) {
      // Also check tenant-specific roles
      const tenant = c.get('tenant');
      if (tenant) {
        const membership = user.tenantMemberships.find((m) => m.tenantId === tenant.id);
        if (membership && roles.includes(membership.role)) {
          return next();
        }
      }

      return c.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Insufficient permissions for this action',
          },
        },
        403
      );
    }

    return next();
  });
}

/**
 * Middleware to verify user belongs to current tenant
 */
export const requireTenantMembership = createMiddleware<{
  Bindings: Env;
  Variables: Variables;
}>(async (c, next) => {
  const user = c.get('user');
  const tenant = c.get('tenant');

  if (!user) {
    return c.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      },
      401
    );
  }

  // Global admin has access to all tenants
  if (user.role === 'global_admin') {
    return next();
  }

  if (!tenant) {
    return c.json(
      {
        success: false,
        error: {
          code: 'TENANT_REQUIRED',
          message: 'Tenant context required',
        },
      },
      400
    );
  }

  // Check if user is a member of this tenant
  const isMember = user.tenantMemberships.some((m) => m.tenantId === tenant.id);
  if (!isMember) {
    return c.json(
      {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have access to this tenant',
        },
      },
      403
    );
  }

  return next();
});
