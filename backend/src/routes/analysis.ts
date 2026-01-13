import { Request, Response, NextFunction } from 'express';
import type {
  AnalyzeRequest,
  ErrorResponse,
  IntentAnalysis,
  ToneAnalysis,
  ImpactAnalysis,
  Alternative,
} from '@communication-mirror/shared';
import type { LLMService } from '../../lib/llm-service.js';

/**
 * Individual Analysis Routes
 * 
 * Provides separate endpoints for each analysis type:
 * - Intent analysis
 * - Tone analysis
 * - Impact prediction
 * - Alternative generation
 */

type SessionManager = ReturnType<typeof import('../../lib/session-manager.js').getSessionManager>;

/**
 * Helper to get or create session
 */
function getOrCreateSession(
  sessionManager: SessionManager,
  providedSessionId?: string
): { sessionId: string; context: string | null } {
  let sessionId = providedSessionId;
  if (!sessionId) {
    const session = sessionManager.createSession();
    sessionId = session.id;
    console.log(`[Analysis] Created new session: ${sessionId}`);
  } else {
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      // Session not found, create a new one automatically
      const newSession = sessionManager.createSession();
      sessionId = newSession.id;
      console.log(`[Analysis] Session not found, created new session: ${sessionId}`);
    } else {
      console.log(`[Analysis] Using existing session: ${sessionId}`);
    }
  }

  const context = sessionManager.formatContext(sessionId);
  return { sessionId, context };
}

/**
 * @swagger
 * /api/analyze/intent:
 *   post:
 *     summary: Analyze message intent
 *     description: Analyzes the intent of a communication message (primary, secondary, implicit).
 *     tags: [Analysis]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AnalyzeRequest'
 *     responses:
 *       200:
 *         description: Intent analysis completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/IntentAnalysis'
 *                 sessionId:
 *                   type: string
 *       400:
 *         description: Invalid request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       503:
 *         description: Model is not ready
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
export function createIntentHandler(
  llmService: LLMService,
  sessionManager: SessionManager
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { message, sessionId: providedSessionId } = req.body as AnalyzeRequest;

      console.log(`[Intent] Analyzing: "${message.substring(0, 50)}..."`);

      const { sessionId, context } = getOrCreateSession(sessionManager, providedSessionId);

      const intent = await llmService.analyzeIntent(message, context || undefined, sessionId);

      res.json({
        success: true,
        data: intent,
        sessionId,
      });
    } catch (error) {
      console.error('[Intent] Error:', error);
      next(error);
    }
  };
}

/**
 * @swagger
 * /api/analyze/tone:
 *   post:
 *     summary: Analyze message tone
 *     description: Analyzes the emotional tone and sentiment of a communication message.
 *     tags: [Analysis]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AnalyzeRequest'
 *     responses:
 *       200:
 *         description: Tone analysis completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/ToneAnalysis'
 *                 sessionId:
 *                   type: string
 *       400:
 *         description: Invalid request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       503:
 *         description: Model is not ready
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
export function createToneHandler(
  llmService: LLMService,
  sessionManager: SessionManager
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { message, sessionId: providedSessionId } = req.body as AnalyzeRequest;

      console.log(`[Tone] Analyzing: "${message.substring(0, 50)}..."`);

      const { sessionId, context } = getOrCreateSession(sessionManager, providedSessionId);

      const tone = await llmService.analyzeTone(message, context || undefined, sessionId);

      res.json({
        success: true,
        data: tone,
        sessionId,
      });
    } catch (error) {
      console.error('[Tone] Error:', error);
      next(error);
    }
  };
}

/**
 * @swagger
 * /api/analyze/impact:
 *   post:
 *     summary: Predict recipient impact
 *     description: Predicts how the recipient will likely perceive and react to the message.
 *     tags: [Analysis]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AnalyzeRequest'
 *     responses:
 *       200:
 *         description: Impact analysis completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/ImpactAnalysis'
 *                 sessionId:
 *                   type: string
 *       400:
 *         description: Invalid request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       503:
 *         description: Model is not ready
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
export function createImpactHandler(
  llmService: LLMService,
  sessionManager: SessionManager
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { message, sessionId: providedSessionId } = req.body as AnalyzeRequest;

      console.log(`[Impact] Analyzing: "${message.substring(0, 50)}..."`);

      const { sessionId, context } = getOrCreateSession(sessionManager, providedSessionId);

      const impact = await llmService.predictImpact(message, context || undefined, sessionId);

      res.json({
        success: true,
        data: impact,
        sessionId,
      });
    } catch (error) {
      console.error('[Impact] Error:', error);
      next(error);
    }
  };
}

/**
 * @swagger
 * /api/analyze/alternatives:
 *   post:
 *     summary: Generate alternative phrasings
 *     description: Generates alternative phrasings that achieve the same goal with better emotional impact.
 *     tags: [Analysis]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AnalyzeRequest'
 *     responses:
 *       200:
 *         description: Alternatives generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Alternative'
 *                 sessionId:
 *                   type: string
 *       400:
 *         description: Invalid request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       503:
 *         description: Model is not ready
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
export function createAlternativesHandler(
  llmService: LLMService,
  sessionManager: SessionManager
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { message, sessionId: providedSessionId } = req.body as AnalyzeRequest;

      console.log(`[Alternatives] Generating for: "${message.substring(0, 50)}..."`);

      const { sessionId, context } = getOrCreateSession(sessionManager, providedSessionId);

      const alternatives = await llmService.generateAlternatives(message, context || undefined, sessionId);

      res.json({
        success: true,
        data: alternatives,
        sessionId,
      });
    } catch (error) {
      console.error('[Alternatives] Error:', error);
      next(error);
    }
  };
}
