import { Router, Request, Response } from 'express';
import type { ErrorResponse } from '@communication-mirror/shared';

/**
 * Session Management Routes
 * 
 * Provides endpoints for creating and managing conversation sessions.
 */

type SessionManager = ReturnType<typeof import('../../lib/session-manager.js').getSessionManager>;

/**
 * @swagger
 * /api/sessions:
 *   post:
 *     summary: Create a new conversation session
 *     description: Creates a new session for maintaining conversation context across multiple analysis requests.
 *     tags: [Status]
 *     responses:
 *       201:
 *         description: Session created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 sessionId:
 *                   type: string
 *                   description: Unique session identifier to use in subsequent requests
 *                   example: "550e8400-e29b-41d4-a716-446655440000"
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
export function createSessionsRouter(sessionManager: SessionManager): Router {
  const router = Router();

  router.post('/api/sessions', (_req: Request, res: Response) => {
    const session = sessionManager.createSession();
    res.status(201).json({
      success: true,
      sessionId: session.id,
      createdAt: session.createdAt.toISOString(),
    });
  });

  /**
   * @swagger
   * /api/sessions/{sessionId}:
   *   get:
   *     summary: Get session information
   *     description: Returns information about a specific session including interaction count and last access time.
   *     tags: [Status]
   *     parameters:
   *       - in: path
   *         name: sessionId
   *         required: true
   *         schema:
   *           type: string
   *         description: The session ID to retrieve
   *     responses:
   *       200:
   *         description: Session information
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 sessionId:
   *                   type: string
   *                 createdAt:
   *                   type: string
   *                   format: date-time
   *                 lastAccessedAt:
   *                   type: string
   *                   format: date-time
   *                 interactionCount:
   *                   type: integer
   *       404:
   *         description: Session not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  router.get('/api/sessions/:sessionId', (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const session = sessionManager.getSession(sessionId);

    if (!session) {
      const error: ErrorResponse = {
        success: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Session not found',
        },
      };
      res.status(404).json(error);
      return;
    }

    const interactions = sessionManager.getInteractions(sessionId);

    res.json({
      success: true,
      sessionId: session.id,
      createdAt: session.createdAt.toISOString(),
      lastAccessedAt: session.lastAccessedAt.toISOString(),
      interactionCount: interactions.length,
    });
  });

  /**
   * @swagger
   * /api/sessions/{sessionId}:
   *   delete:
   *     summary: Delete a session
   *     description: Deletes a session and all its associated conversation history.
   *     tags: [Status]
   *     parameters:
   *       - in: path
   *         name: sessionId
   *         required: true
   *         schema:
   *           type: string
   *         description: The session ID to delete
   *     responses:
   *       200:
   *         description: Session deleted successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   *       404:
   *         description: Session not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  router.delete('/api/sessions/:sessionId', (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const deleted = sessionManager.deleteSession(sessionId);

    if (!deleted) {
      const error: ErrorResponse = {
        success: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Session not found',
        },
      };
      res.status(404).json(error);
      return;
    }

    res.json({
      success: true,
      message: 'Session deleted successfully',
    });
  });

  return router;
}
