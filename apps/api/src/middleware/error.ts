import type { Context } from 'hono';
import type { Env, Variables } from '@retreatflow360/shared-types';
import { ZodError } from 'zod';

export function errorHandler(
  err: Error,
  c: Context<{ Bindings: Env; Variables: Variables }>
): Response {
  const requestId = c.get('requestId');

  console.error(`[${requestId}] Error:`, err);

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: err.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        },
      },
      400
    );
  }

  // Handle known error types
  if (err.name === 'NotFoundError') {
    return c.json(
      {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: err.message || 'Resource not found',
        },
      },
      404
    );
  }

  if (err.name === 'UnauthorizedError') {
    return c.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: err.message || 'Authentication required',
        },
      },
      401
    );
  }

  if (err.name === 'ForbiddenError') {
    return c.json(
      {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: err.message || 'Access denied',
        },
      },
      403
    );
  }

  if (err.name === 'ConflictError') {
    return c.json(
      {
        success: false,
        error: {
          code: 'CONFLICT',
          message: err.message || 'Resource conflict',
        },
      },
      409
    );
  }

  if (err.name === 'ValidationError') {
    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: err.message || 'Validation failed',
        },
      },
      400
    );
  }

  // Default to internal server error
  return c.json(
    {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message:
          c.env.ENVIRONMENT === 'production'
            ? 'An unexpected error occurred'
            : err.message || 'An unexpected error occurred',
      },
    },
    500
  );
}

// Custom error classes
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
