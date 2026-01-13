import { Router, Request, Response } from 'express';
import type { LLMService } from '../../lib/llm-service.js';
import { config } from '../config.js';

/**
 * Status routes
 * 
 * Provides information about:
 * - Model loading status
 * - Service state
 * - Session context
 */
export function createStatusRouter(
  llmService: LLMService,
  modelLoading: boolean,
  modelLoadError: Error | null,
  sessionManager: ReturnType<typeof import('../../lib/session-manager.js').getSessionManager>
): Router {
  const router = Router();

  /**
   * @swagger
   * /api/status:
   *   get:
   *     summary: Get service and model status
   *     description: Returns the current status of the model loading process and service state.
   *     tags: [Status]
   *     responses:
   *       200:
   *         description: Status information
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/StatusResponse'
   */
  router.get('/api/status', (_req: Request, res: Response) => {
    res.json({
      modelReady: llmService.initialized,
      modelLoading,
      modelPath: config.modelPath,
      error: modelLoadError
        ? {
            message: modelLoadError.message,
            stack: config.nodeEnv === 'development' ? modelLoadError.stack : undefined,
          }
        : null,
    });
  });

  /**
   * @swagger
   * /api/context/{sessionId}:
   *   get:
   *     summary: Get conversation context for a session
   *     description: Returns the conversation history and context for a given session ID.
   *     tags: [Status]
   *     parameters:
   *       - in: path
   *         name: sessionId
   *         required: true
   *         schema:
   *           type: string
   *         description: The session ID to retrieve context for
   *     responses:
   *       200:
   *         description: Session context retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 sessionId:
   *                   type: string
   *                 interactions:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       message:
   *                         type: string
   *                       timestamp:
   *                         type: string
   *                         format: date-time
   *                 context:
   *                   type: string
   *                   nullable: true
   *       404:
   *         description: Session not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  router.get('/api/context/:sessionId', (req: Request, res: Response) => {
    const { sessionId } = req.params;

    const session = sessionManager.getSession(sessionId);
    if (!session) {
      res.status(404).json({
        success: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Session not found',
        },
      });
      return;
    }

    const interactions = sessionManager.getInteractions(sessionId);
    const context = sessionManager.formatContext(sessionId);

    res.json({
      sessionId: session.id,
      createdAt: session.createdAt.toISOString(),
      lastAccessedAt: session.lastAccessedAt.toISOString(),
      interactions: interactions.map((i) => ({
        message: i.message,
        timestamp: i.timestamp.toISOString(),
      })),
      context,
    });
  });

  return router;
}
