import { Request, Response, NextFunction } from 'express';
import type { ErrorResponse } from '@communication-mirror/shared';
import type { LLMService } from '../../lib/llm-service.js';

/**
 * Middleware to ensure the LLM model is ready before processing requests
 * 
 * Returns 503 Service Unavailable if:
 * - Model is still loading
 * - Model failed to load
 * - Model is not initialized
 */
export function requireModelReady(
  llmService: LLMService,
  modelLoading: boolean,
  modelLoadError: Error | null
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!llmService.initialized) {
      const error: ErrorResponse = {
        success: false,
        error: {
          code: 'MODEL_NOT_READY',
          message: modelLoading
            ? 'Model is still loading. Please try again in a moment.'
            : modelLoadError
              ? `Model failed to load: ${modelLoadError.message}`
              : 'Model is not available.',
        },
      };
      res.status(503).json(error);
      return;
    }
    next();
  };
}
