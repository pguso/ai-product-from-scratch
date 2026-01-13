import { Request, Response, NextFunction } from 'express';
import type { ErrorResponse } from '@shared';
import { config } from '../config.js';

/**
 * Global error handler middleware
 * 
 * Catches all unhandled errors and returns a consistent error response.
 * In development, includes error details for debugging.
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  console.error('Unhandled error:', err);
  console.error('Stack:', err.stack);

  // Don't send response if headers already sent
  if (res.headersSent) {
    return next(err);
  }

  const error: ErrorResponse = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      details: config.nodeEnv === 'development' ? err.message : undefined,
    },
  };

  res.status(500).json(error);
}
