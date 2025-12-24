/**
 * OAuth provider types
 */

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
}

export interface OAuthUserInfo {
  id: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  picture?: string;
  emailVerified?: boolean;
  provider: 'microsoft' | 'google' | 'apple';
  raw: Record<string, unknown>;
}

export interface OAuthState {
  returnTo?: string;
  tenantSlug?: string;
  nonce: string;
}

export class OAuthError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'OAuthError';
  }
}
