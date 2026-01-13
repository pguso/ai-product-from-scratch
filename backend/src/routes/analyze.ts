import { Request, Response, NextFunction } from 'express';
import type {
  AnalyzeRequest,
  AnalyzeResponse,
  ErrorResponse,
  AnalysisResult,
} from '@communication-mirror/shared';
import type { LLMService } from '../../lib/llm-service.js';

/**
 * Analyze route handler
 * 
 * Main endpoint for analyzing communication messages.
 * Handles session management and coordinates parallel LLM analysis.
 */
export function createAnalyzeHandler(
  llmService: LLMService,
  sessionManager: ReturnType<typeof import('../../lib/session-manager.js').getSessionManager>
) {
  /**
   * @swagger
   * /api/analyze:
   *   post:
   *     summary: Analyze a communication message
   *     description: Analyzes a message for intent, tone, impact, and generates alternative phrasings. Requires the model to be loaded.
   *     tags: [Analysis]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/AnalyzeRequest'
   *     responses:
   *       200:
   *         description: Analysis completed successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/AnalyzeResponse'
   *       400:
   *         description: Invalid request (missing message, empty message, or message too long)
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       503:
   *         description: Model is not ready (still loading or failed to load)
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { message, sessionId: providedSessionId } = req.body as AnalyzeRequest;

        console.log(`[Analyze] Processing request for message: "${message.substring(0, 50)}..."`);

        // Get or create session
        let sessionId = providedSessionId;
        if (!sessionId) {
          const session = sessionManager.createSession();
          sessionId = session.id;
          console.log(`[Analyze] Created new session: ${sessionId}`);
        } else {
          // Validate session exists, create new one if not found
          const session = sessionManager.getSession(sessionId);
          if (!session) {
            const newSession = sessionManager.createSession();
            sessionId = newSession.id;
            console.log(`[Analyze] Session not found, created new session: ${sessionId}`);
          } else {
            console.log(`[Analyze] Using existing session: ${sessionId}`);
          }
        }

        // Get conversation context if available
        const context = sessionManager.formatContext(sessionId);
        if (context) {
          console.log(
            `[Analyze] Using context from ${sessionManager.getInteractions(sessionId).length} previous interactions`
          );
        }

        // Run all analyses in parallel using batching
        console.log('[Analyze] Starting batched LLM analysis...');
        const data = await llmService.analyzeBatched(message, context || undefined, sessionId);
        console.log('[Analyze] Batched LLM analysis completed');

        // Store interaction in session
        sessionManager.addInteraction(sessionId, message, data);

        const response: AnalyzeResponse = {
          success: true,
          data,
          sessionId,
        };

        res.json(response);
      } catch (error) {
        console.error('[Analyze] Error:', error);
        next(error);
      }
    };
}
