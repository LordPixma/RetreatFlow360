/**
 * Microsoft OAuth 2.0 / Azure AD integration
 * Supports both personal Microsoft accounts and Azure AD (work/school)
 */

import type { OAuthConfig, OAuthTokenResponse, OAuthUserInfo, OAuthState } from './types';
import { OAuthError } from './types';

export interface MicrosoftOAuthConfig extends OAuthConfig {
  tenantId: string; // 'common', 'consumers', 'organizations', or specific tenant ID
}

// Microsoft OAuth endpoints
const MICROSOFT_AUTH_BASE = 'https://login.microsoftonline.com';
const MICROSOFT_GRAPH_API = 'https://graph.microsoft.com/v1.0';

/**
 * Generate the Microsoft OAuth authorization URL
 */
export function getMicrosoftAuthUrl(
  config: MicrosoftOAuthConfig,
  state: OAuthState,
  scopes: string[] = ['openid', 'email', 'profile', 'User.Read']
): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    redirect_uri: config.redirectUri,
    scope: scopes.join(' '),
    state: encodeState(state),
    response_mode: 'query',
    prompt: 'select_account', // Always show account picker
  });

  return `${MICROSOFT_AUTH_BASE}/${config.tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeMicrosoftCode(
  code: string,
  config: MicrosoftOAuthConfig
): Promise<OAuthTokenResponse> {
  const tokenUrl = `${MICROSOFT_AUTH_BASE}/${config.tenantId}/oauth2/v2.0/token`;

  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: config.redirectUri,
    grant_type: 'authorization_code',
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new OAuthError(
      'TOKEN_EXCHANGE_FAILED',
      `Failed to exchange code: ${(error as Record<string, string>).error_description || response.statusText}`,
      response.status
    );
  }

  return response.json() as Promise<OAuthTokenResponse>;
}

/**
 * Refresh an access token using a refresh token
 */
export async function refreshMicrosoftToken(
  refreshToken: string,
  config: MicrosoftOAuthConfig
): Promise<OAuthTokenResponse> {
  const tokenUrl = `${MICROSOFT_AUTH_BASE}/${config.tenantId}/oauth2/v2.0/token`;

  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new OAuthError(
      'TOKEN_REFRESH_FAILED',
      `Failed to refresh token: ${(error as Record<string, string>).error_description || response.statusText}`,
      response.status
    );
  }

  return response.json() as Promise<OAuthTokenResponse>;
}

/**
 * Get user info from Microsoft Graph API
 */
export async function getMicrosoftUserInfo(accessToken: string): Promise<OAuthUserInfo> {
  const response = await fetch(`${MICROSOFT_GRAPH_API}/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new OAuthError(
      'USER_INFO_FAILED',
      `Failed to get user info: ${response.statusText}`,
      response.status
    );
  }

  const data = (await response.json()) as MicrosoftGraphUser;

  return {
    id: data.id,
    email: data.mail || data.userPrincipalName,
    name: data.displayName,
    firstName: data.givenName,
    lastName: data.surname,
    emailVerified: true, // Microsoft accounts are verified
    provider: 'microsoft',
    raw: data as unknown as Record<string, unknown>,
  };
}

/**
 * Get user's profile photo from Microsoft Graph
 * Returns base64 encoded image or null if not available
 */
export async function getMicrosoftUserPhoto(accessToken: string): Promise<string | null> {
  try {
    const response = await fetch(`${MICROSOFT_GRAPH_API}/me/photo/$value`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const blob = await response.blob();
    const buffer = await blob.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    const contentType = response.headers.get('Content-Type') || 'image/jpeg';

    return `data:${contentType};base64,${base64}`;
  } catch {
    return null;
  }
}

/**
 * Complete Microsoft OAuth flow
 * Exchanges code, gets user info, and returns combined result
 */
export async function completeMicrosoftOAuth(
  code: string,
  config: MicrosoftOAuthConfig
): Promise<{
  tokens: OAuthTokenResponse;
  user: OAuthUserInfo;
}> {
  // Exchange code for tokens
  const tokens = await exchangeMicrosoftCode(code, config);

  // Get user info
  const user = await getMicrosoftUserInfo(tokens.access_token);

  // Optionally get profile photo
  const photo = await getMicrosoftUserPhoto(tokens.access_token);
  if (photo) {
    user.picture = photo;
  }

  return { tokens, user };
}

/**
 * Validate and decode ID token (basic validation, not full JWT verification)
 * For production, consider using a proper JWT library
 */
export function decodeMicrosoftIdToken(idToken: string): MicrosoftIdTokenPayload | null {
  try {
    const parts = idToken.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(atob(parts[1]!.replace(/-/g, '+').replace(/_/g, '/')));
    return payload as MicrosoftIdTokenPayload;
  } catch {
    return null;
  }
}

/**
 * Encode OAuth state for URL
 */
export function encodeState(state: OAuthState): string {
  return btoa(JSON.stringify(state)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Decode OAuth state from URL
 */
export function decodeState(encoded: string): OAuthState | null {
  try {
    const padded = encoded + '='.repeat((4 - (encoded.length % 4)) % 4);
    const json = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as OAuthState;
  } catch {
    return null;
  }
}

/**
 * Generate a secure nonce for OAuth state
 */
export function generateNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Microsoft Graph API user response type
interface MicrosoftGraphUser {
  id: string;
  displayName: string;
  givenName?: string;
  surname?: string;
  mail?: string;
  userPrincipalName: string;
  jobTitle?: string;
  officeLocation?: string;
  mobilePhone?: string;
  businessPhones?: string[];
}

// Microsoft ID token payload
interface MicrosoftIdTokenPayload {
  aud: string;
  iss: string;
  iat: number;
  exp: number;
  sub: string;
  email?: string;
  name?: string;
  oid?: string;
  preferred_username?: string;
  tid?: string;
}
