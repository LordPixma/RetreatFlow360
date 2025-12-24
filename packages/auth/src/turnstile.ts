/**
 * Cloudflare Turnstile bot protection integration
 * https://developers.cloudflare.com/turnstile/
 */

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export interface TurnstileVerifyResponse {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  'error-codes'?: string[];
  action?: string;
  cdata?: string;
}

export interface TurnstileVerifyOptions {
  secretKey: string;
  token: string;
  remoteIp?: string;
  idempotencyKey?: string;
}

/**
 * Verify a Turnstile token
 */
export async function verifyTurnstileToken(
  options: TurnstileVerifyOptions
): Promise<TurnstileVerifyResponse> {
  const formData = new FormData();
  formData.append('secret', options.secretKey);
  formData.append('response', options.token);

  if (options.remoteIp) {
    formData.append('remoteip', options.remoteIp);
  }

  if (options.idempotencyKey) {
    formData.append('idempotency_key', options.idempotencyKey);
  }

  const response = await fetch(TURNSTILE_VERIFY_URL, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new TurnstileError(
      'VERIFICATION_FAILED',
      `Turnstile verification request failed: ${response.statusText}`
    );
  }

  return response.json() as Promise<TurnstileVerifyResponse>;
}

/**
 * Verify and validate a Turnstile token (throws on failure)
 */
export async function requireValidTurnstile(
  options: TurnstileVerifyOptions
): Promise<TurnstileVerifyResponse> {
  const result = await verifyTurnstileToken(options);

  if (!result.success) {
    const errorCodes = result['error-codes'] || ['unknown'];
    throw new TurnstileError(
      'VERIFICATION_FAILED',
      `Turnstile verification failed: ${errorCodes.join(', ')}`
    );
  }

  return result;
}

/**
 * Get human-readable error message for Turnstile error codes
 */
export function getTurnstileErrorMessage(errorCode: string): string {
  const errorMessages: Record<string, string> = {
    'missing-input-secret': 'The secret key is missing',
    'invalid-input-secret': 'The secret key is invalid',
    'missing-input-response': 'The response token is missing',
    'invalid-input-response': 'The response token is invalid or has expired',
    'invalid-widget-id': 'The widget ID is invalid',
    'invalid-parsed-secret': 'The secret key could not be parsed',
    'bad-request': 'The request was malformed',
    'timeout-or-duplicate': 'The token has expired or has already been used',
    'internal-error': 'An internal error occurred',
  };

  return errorMessages[errorCode] || `Unknown error: ${errorCode}`;
}

/**
 * Custom Turnstile error class
 */
export class TurnstileError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'TurnstileError';
  }
}

/**
 * Check if Turnstile should be skipped (for development/testing)
 */
export function shouldSkipTurnstile(environment: string): boolean {
  return environment === 'development' || environment === 'test';
}
