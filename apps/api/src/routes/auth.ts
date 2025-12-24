import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { ulid } from 'ulid';
import { eq, and, isNull } from 'drizzle-orm';
import type { Env, Variables } from '@retreatflow360/shared-types';
import { users, refreshTokens, userTenantMemberships, tenants } from '@retreatflow360/database';
import {
  createAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  hashPassword,
  verifyPassword,
  verifyTurnstileToken,
  getMicrosoftAuthUrl,
  completeMicrosoftOAuth,
  generateNonce,
  type MicrosoftOAuthConfig,
  type OAuthState,
} from '@retreatflow360/auth';
import {
  loginSchema,
  registerSchema,
  refreshTokenSchema,
} from '@retreatflow360/validation';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * Login endpoint
 */
app.post('/login', zValidator('json', loginSchema), async (c) => {
  const { email, password, turnstileToken } = c.req.valid('json');
  const db = c.get('db');

  // Verify Turnstile token if configured
  if (c.env.TURNSTILE_SECRET_KEY && turnstileToken) {
    const result = await verifyTurnstileToken({
      secretKey: c.env.TURNSTILE_SECRET_KEY,
      token: turnstileToken,
    });
    if (!result.success) {
      return c.json(
        {
          success: false,
          error: {
            code: 'BOT_DETECTED',
            message: 'Bot verification failed. Please try again.',
          },
        },
        403
      );
    }
  }

  // Find user
  const user = await db
    .select()
    .from(users)
    .where(and(eq(users.email, email.toLowerCase()), isNull(users.deletedAt)))
    .limit(1)
    .then((r) => r[0]);

  if (!user || !user.passwordHash) {
    return c.json(
      {
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      },
      401
    );
  }

  // Verify password
  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    return c.json(
      {
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      },
      401
    );
  }

  // Get user's tenant memberships
  const memberships = await db
    .select({
      tenantId: userTenantMemberships.tenantId,
      tenantName: tenants.name,
      tenantSlug: tenants.slug,
      role: userTenantMemberships.role,
    })
    .from(userTenantMemberships)
    .innerJoin(tenants, eq(tenants.id, userTenantMemberships.tenantId))
    .where(eq(userTenantMemberships.userId, user.id));

  // Create tokens
  const accessToken = await createAccessToken(
    { sub: user.id, email: user.email, role: user.role },
    c.env.JWT_SECRET,
    c.env.JWT_ISSUER
  );

  const { token: refreshToken, hash: refreshTokenHash } = await generateRefreshToken();

  // Store refresh token
  const now = new Date();
  await db.insert(refreshTokens).values({
    id: ulid(),
    userId: user.id,
    tokenHash: refreshTokenHash,
    expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days
    createdAt: now,
  });

  const profileData = user.profileData as { firstName?: string; lastName?: string; avatar?: string } | null;

  return c.json({
    success: true,
    data: {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        profile: {
          firstName: profileData?.firstName,
          lastName: profileData?.lastName,
          avatar: profileData?.avatar,
        },
        tenantMemberships: memberships,
      },
    },
  });
});

/**
 * Register endpoint
 */
app.post('/register', zValidator('json', registerSchema), async (c) => {
  const { email, password, firstName, lastName, turnstileToken } = c.req.valid('json');
  const db = c.get('db');

  // Verify Turnstile token if configured
  if (c.env.TURNSTILE_SECRET_KEY && turnstileToken) {
    const result = await verifyTurnstileToken({
      secretKey: c.env.TURNSTILE_SECRET_KEY,
      token: turnstileToken,
    });
    if (!result.success) {
      return c.json(
        {
          success: false,
          error: {
            code: 'BOT_DETECTED',
            message: 'Bot verification failed. Please try again.',
          },
        },
        403
      );
    }
  }

  // Check if user exists
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1)
    .then((r) => r[0]);

  if (existing) {
    return c.json(
      {
        success: false,
        error: {
          code: 'EMAIL_EXISTS',
          message: 'An account with this email already exists',
        },
      },
      409
    );
  }

  // Hash password and create user
  const passwordHashValue = await hashPassword(password);
  const now = new Date();
  const userId = ulid();

  await db.insert(users).values({
    id: userId,
    email: email.toLowerCase(),
    passwordHash: passwordHashValue,
    role: 'attendee',
    profileData: {
      firstName,
      lastName,
    },
    createdAt: now,
    updatedAt: now,
  });

  // Create tokens
  const accessToken = await createAccessToken(
    { sub: userId, email: email.toLowerCase(), role: 'attendee' },
    c.env.JWT_SECRET,
    c.env.JWT_ISSUER
  );

  const { token: refreshToken, hash: refreshTokenHash } = await generateRefreshToken();

  await db.insert(refreshTokens).values({
    id: ulid(),
    userId,
    tokenHash: refreshTokenHash,
    expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    createdAt: now,
  });

  return c.json(
    {
      success: true,
      data: {
        accessToken,
        refreshToken,
        expiresIn: 900,
        user: {
          id: userId,
          email: email.toLowerCase(),
          role: 'attendee',
          profile: {
            firstName,
            lastName,
          },
          tenantMemberships: [],
        },
      },
    },
    201
  );
});

/**
 * Refresh token endpoint
 */
app.post('/refresh', zValidator('json', refreshTokenSchema), async (c) => {
  const { refreshToken } = c.req.valid('json');
  const db = c.get('db');

  // Hash the provided token
  const tokenHash = await hashRefreshToken(refreshToken);

  // Find and validate refresh token
  const storedToken = await db
    .select({
      id: refreshTokens.id,
      userId: refreshTokens.userId,
      expiresAt: refreshTokens.expiresAt,
    })
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, tokenHash))
    .limit(1)
    .then((r) => r[0]);

  if (!storedToken || storedToken.expiresAt < new Date()) {
    return c.json(
      {
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired refresh token',
        },
      },
      401
    );
  }

  // Get user
  const user = await db
    .select()
    .from(users)
    .where(and(eq(users.id, storedToken.userId), isNull(users.deletedAt)))
    .limit(1)
    .then((r) => r[0]);

  if (!user) {
    return c.json(
      {
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      },
      401
    );
  }

  // Delete old refresh token (rotation)
  await db.delete(refreshTokens).where(eq(refreshTokens.id, storedToken.id));

  // Create new tokens
  const accessToken = await createAccessToken(
    { sub: user.id, email: user.email, role: user.role },
    c.env.JWT_SECRET,
    c.env.JWT_ISSUER
  );

  const { token: newRefreshToken, hash: newRefreshTokenHash } = await generateRefreshToken();
  const now = new Date();

  await db.insert(refreshTokens).values({
    id: ulid(),
    userId: user.id,
    tokenHash: newRefreshTokenHash,
    expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    createdAt: now,
  });

  return c.json({
    success: true,
    data: {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: 900,
    },
  });
});

/**
 * Microsoft OAuth - initiate login
 */
app.get('/oauth/microsoft', async (c) => {
  const config: MicrosoftOAuthConfig = {
    clientId: c.env.MICROSOFT_CLIENT_ID,
    clientSecret: c.env.MICROSOFT_CLIENT_SECRET,
    redirectUri: `${c.env.API_BASE_URL}/api/v1/auth/oauth/microsoft/callback`,
    tenantId: c.env.MICROSOFT_TENANT_ID || 'common',
  };

  // Generate state for CSRF protection
  const nonce = generateNonce();
  const tenant = c.get('tenant');
  const oauthState: OAuthState = {
    nonce,
    tenantSlug: tenant?.slug,
    returnTo: c.req.query('returnTo'),
  };

  // Store state in KV for verification (5 minute TTL)
  await c.env.KV.put(`oauth_state:${nonce}`, JSON.stringify(oauthState), { expirationTtl: 300 });

  const authUrl = getMicrosoftAuthUrl(config, oauthState);

  return c.redirect(authUrl);
});

/**
 * Microsoft OAuth - callback
 */
app.get('/oauth/microsoft/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');
  const errorDescription = c.req.query('error_description');

  if (error) {
    return c.json(
      {
        success: false,
        error: {
          code: 'OAUTH_ERROR',
          message: errorDescription || error,
        },
      },
      400
    );
  }

  if (!code || !state) {
    return c.json(
      {
        success: false,
        error: {
          code: 'INVALID_CALLBACK',
          message: 'Missing code or state parameter',
        },
      },
      400
    );
  }

  // Decode and verify state
  let oauthState: OAuthState;
  try {
    // State is base64 encoded JSON
    const padded = state + '='.repeat((4 - (state.length % 4)) % 4);
    const decoded = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
    oauthState = JSON.parse(decoded) as OAuthState;
  } catch {
    return c.json(
      {
        success: false,
        error: {
          code: 'INVALID_STATE',
          message: 'Could not decode state parameter',
        },
      },
      400
    );
  }

  // Verify state was stored (prevents CSRF)
  const storedState = await c.env.KV.get(`oauth_state:${oauthState.nonce}`);
  if (!storedState) {
    return c.json(
      {
        success: false,
        error: {
          code: 'INVALID_STATE',
          message: 'Invalid or expired state parameter',
        },
      },
      400
    );
  }

  // Delete state from KV
  await c.env.KV.delete(`oauth_state:${oauthState.nonce}`);

  const config: MicrosoftOAuthConfig = {
    clientId: c.env.MICROSOFT_CLIENT_ID,
    clientSecret: c.env.MICROSOFT_CLIENT_SECRET,
    redirectUri: `${c.env.API_BASE_URL}/api/v1/auth/oauth/microsoft/callback`,
    tenantId: c.env.MICROSOFT_TENANT_ID || 'common',
  };

  try {
    const { user: oauthUser } = await completeMicrosoftOAuth(code, config);
    const db = c.get('db');

    // Find or create user
    let user = await db
      .select()
      .from(users)
      .where(and(eq(users.email, oauthUser.email.toLowerCase()), isNull(users.deletedAt)))
      .limit(1)
      .then((r) => r[0]);

    const now = new Date();

    let userId: string;
    let userEmail: string;
    let userRole: 'global_admin' | 'tenant_owner' | 'tenant_admin' | 'staff' | 'attendee';

    if (!user) {
      // Create new user
      userId = ulid();
      userEmail = oauthUser.email.toLowerCase();
      userRole = 'attendee';

      await db.insert(users).values({
        id: userId,
        email: userEmail,
        role: userRole,
        emailVerified: true, // OAuth users are pre-verified
        profileData: {
          firstName: oauthUser.firstName || oauthUser.name?.split(' ')[0] || '',
          lastName: oauthUser.lastName || oauthUser.name?.split(' ').slice(1).join(' ') || '',
          avatar: oauthUser.picture,
        },
        createdAt: now,
        updatedAt: now,
      });
    } else {
      userId = user.id;
      userEmail = user.email;
      userRole = user.role as typeof userRole;
    }

    // Create tokens
    const accessToken = await createAccessToken(
      { sub: userId, email: userEmail, role: userRole },
      c.env.JWT_SECRET,
      c.env.JWT_ISSUER
    );

    const { token: refreshToken, hash: refreshTokenHash } = await generateRefreshToken();

    await db.insert(refreshTokens).values({
      id: ulid(),
      userId,
      tokenHash: refreshTokenHash,
      expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      createdAt: now,
    });

    // Redirect to frontend with tokens (in production, use a more secure method)
    const frontendUrl = c.env.FRONTEND_URL || 'http://localhost:5173';
    const returnTo = oauthState.returnTo || '/';
    const params = new URLSearchParams({
      accessToken,
      refreshToken,
      expiresIn: '900',
      returnTo,
    });

    return c.redirect(`${frontendUrl}/auth/callback?${params.toString()}`);
  } catch (err) {
    return c.json(
      {
        success: false,
        error: {
          code: 'OAUTH_FAILED',
          message: err instanceof Error ? err.message : 'OAuth authentication failed',
        },
      },
      500
    );
  }
});

/**
 * Logout endpoint
 */
app.post('/logout', async (c) => {
  const authHeader = c.req.header('Authorization');

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const payload = await verifyAccessToken(token, c.env.JWT_SECRET, c.env.JWT_ISSUER);
      const db = c.get('db');

      // Delete all refresh tokens for this user (logout from all devices)
      await db.delete(refreshTokens).where(eq(refreshTokens.userId, payload.sub));
    } catch {
      // Token invalid, but that's okay for logout
    }
  }

  return c.json({ success: true });
});

/**
 * Get current user
 */
app.get('/me', async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Not authenticated',
        },
      },
      401
    );
  }

  const db = c.get('db');

  // Get full user data
  const userData = await db
    .select()
    .from(users)
    .where(eq(users.id, user.sub))
    .limit(1)
    .then((r) => r[0]);

  if (!userData) {
    return c.json(
      {
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      },
      404
    );
  }

  // Get tenant memberships
  const memberships = await db
    .select({
      tenantId: userTenantMemberships.tenantId,
      tenantName: tenants.name,
      tenantSlug: tenants.slug,
      role: userTenantMemberships.role,
    })
    .from(userTenantMemberships)
    .innerJoin(tenants, eq(tenants.id, userTenantMemberships.tenantId))
    .where(eq(userTenantMemberships.userId, user.sub));

  const profileData = userData.profileData as { firstName?: string; lastName?: string; avatar?: string } | null;

  return c.json({
    success: true,
    data: {
      id: userData.id,
      email: userData.email,
      role: userData.role,
      emailVerified: userData.emailVerified,
      mfaEnabled: userData.mfaEnabled,
      profile: {
        firstName: profileData?.firstName,
        lastName: profileData?.lastName,
        avatar: profileData?.avatar,
      },
      tenantMemberships: memberships,
    },
  });
});

export default app;
