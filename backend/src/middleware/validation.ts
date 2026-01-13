import { Request, Response, NextFunction } from 'express';
import type { AnalyzeRequest, ErrorResponse } from '@shared';
import { config } from '../config.js';

/**
 * Validates the analyze request body
 * 
 * Ensures:
 * - Message is present and is a string
 * - Message is not empty
 * - Message doesn't exceed maximum length
 */
export function validateAnalyzeRequest(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const { message } = req.body as AnalyzeRequest;

  if (!message || typeof message !== 'string') {
    const error: ErrorResponse = {
      success: false,
      error: {
        code: 'INVALID_REQUEST',
        message: 'Message is required and must be a string',
      },
    };
    res.status(400).json(error);
    return;
  }

  if (message.trim().length === 0) {
    const error: ErrorResponse = {
      success: false,
      error: {
        code: 'EMPTY_MESSAGE',
        message: 'Message cannot be empty',
      },
    };
    res.status(400).json(error);
    return;
  }

  if (message.length > config.maxMessageLength) {
    const error: ErrorResponse = {
      success: false,
      error: {
        code: 'MESSAGE_TOO_LONG',
        message: `Message exceeds maximum length of ${config.maxMessageLength} characters`,
      },
    };
    res.status(400).json(error);
    return;
  }

  next();
}
