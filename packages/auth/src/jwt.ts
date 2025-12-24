/**
 * JWT utilities for access and refresh tokens
 * Uses Web Crypto API for edge runtime compatibility
 */

export interface JWTPayload {
  sub: string; // user id
  email: string;
  role: string;
  tenantId?: string;
  iat: number;
  exp: number;
  iss: string;
}

export interface CreateTokenOptions {
  expiresIn?: number; // seconds
}

const DEFAULT_ACCESS_TOKEN_EXPIRY = 15 * 60; // 15 minutes
const DEFAULT_REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days

/**
 * Base64URL encode
 */
function base64UrlEncode(data: string | Uint8Array): string {
  const str = typeof data === 'string' ? data : String.fromCharCode(...data);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Base64URL decode
 */
function base64UrlDecode(str: string): string {
  const padded = str + '='.repeat((4 - (str.length % 4)) % 4);
  return atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
}

/**
 * Create HMAC-SHA256 signature
 */
async function createSignature(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return base64UrlEncode(new Uint8Array(signature));
}

/**
 * Verify HMAC-SHA256 signature
 */
async function verifySignature(data: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const signatureBytes = Uint8Array.from(base64UrlDecode(signature), (c) => c.charCodeAt(0));
  return crypto.subtle.verify('HMAC', key, signatureBytes, encoder.encode(data));
}

/**
 * Create a JWT access token
 */
export async function createAccessToken(
  payload: { sub: string; email: string; role: string; tenantId?: string },
  secret: string,
  issuer: string,
  options: CreateTokenOptions = {}
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = options.expiresIn ?? DEFAULT_ACCESS_TOKEN_EXPIRY;

  const header = { alg: 'HS256', typ: 'JWT' };
  const tokenPayload: JWTPayload = {
    ...payload,
    iat: now,
    exp: now + expiresIn,
    iss: issuer,
  };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(tokenPayload));
  const signature = await createSignature(`${headerB64}.${payloadB64}`, secret);

  return `${headerB64}.${payloadB64}.${signature}`;
}

/**
 * Verify and decode a JWT token
 */
export async function verifyAccessToken(
  token: string,
  secret: string,
  issuer: string
): Promise<JWTPayload> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new JWTError('INVALID_TOKEN', 'Invalid token format');
  }

  const [headerB64, payloadB64, signature] = parts;

  // Verify signature
  const isValid = await verifySignature(`${headerB64}.${payloadB64}`, signature!, secret);
  if (!isValid) {
    throw new JWTError('INVALID_SIGNATURE', 'Token signature is invalid');
  }

  // Decode payload
  let payload: JWTPayload;
  try {
    payload = JSON.parse(base64UrlDecode(payloadB64!)) as JWTPayload;
  } catch {
    throw new JWTError('INVALID_PAYLOAD', 'Token payload is malformed');
  }

  // Check expiration
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) {
    throw new JWTError('TOKEN_EXPIRED', 'Token has expired');
  }

  // Check issuer
  if (payload.iss !== issuer) {
    throw new JWTError('INVALID_ISSUER', 'Token issuer is invalid');
  }

  return payload;
}

/**
 * Decode a JWT token without verification (for debugging/inspection)
 */
export function decodeToken(token: string): { header: unknown; payload: JWTPayload } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const header = JSON.parse(base64UrlDecode(parts[0]!));
    const payload = JSON.parse(base64UrlDecode(parts[1]!)) as JWTPayload;

    return { header, payload };
  } catch {
    return null;
  }
}

/**
 * Generate a cryptographically secure refresh token
 */
export async function generateRefreshToken(): Promise<{ token: string; hash: string }> {
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  const token = base64UrlEncode(tokenBytes);

  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(token));
  const hash = base64UrlEncode(new Uint8Array(hashBuffer));

  return { token, hash };
}

/**
 * Hash a refresh token for storage comparison
 */
export async function hashRefreshToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(token));
  return base64UrlEncode(new Uint8Array(hashBuffer));
}

/**
 * Calculate refresh token expiry date
 */
export function getRefreshTokenExpiry(expiresInSeconds: number = DEFAULT_REFRESH_TOKEN_EXPIRY): Date {
  return new Date(Date.now() + expiresInSeconds * 1000);
}

/**
 * Check if a token is about to expire (within threshold)
 */
export function isTokenExpiringSoon(payload: JWTPayload, thresholdSeconds: number = 120): boolean {
  const now = Math.floor(Date.now() / 1000);
  return payload.exp - now < thresholdSeconds;
}

/**
 * Custom JWT error class
 */
export class JWTError extends Error {
  constructor(
    public code: 'INVALID_TOKEN' | 'INVALID_SIGNATURE' | 'INVALID_PAYLOAD' | 'TOKEN_EXPIRED' | 'INVALID_ISSUER',
    message: string
  ) {
    super(message);
    this.name = 'JWTError';
  }
}
