import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './swagger.js';
import { createHealthRouter } from './routes/health.js';
import { createStatusRouter } from './routes/status.js';
import { createSessionsRouter } from './routes/sessions.js';
import { createAnalyzeHandler } from './routes/analyze.js';
import {
  createIntentHandler,
  createToneHandler,
  createImpactHandler,
  createAlternativesHandler,
} from './routes/analysis.js';
import { errorHandler } from './middleware/error-handler.js';
import { validateAnalyzeRequest } from './middleware/validation.js';
import { requireModelReady } from './middleware/model-ready.js';
import type { LLMService } from '../lib/llm-service.js';

/**
 * Create and configure Express application
 * 
 * Sets up:
 * - CORS middleware
 * - JSON body parsing
 * - Swagger documentation
 * - Route handlers
 * - Error handling
 */
export function createApp(
  llmService: LLMService,
  modelLoading: boolean,
  modelLoadError: Error | null,
  sessionManager: ReturnType<typeof import('../lib/session-manager.js').getSessionManager>
): express.Application {
  const app = express();

  // Middleware
  app.use(
    cors({
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    })
  );
  app.use(express.json({ limit: '10mb' }));

  // Swagger UI
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'Communication Mirror API Documentation',
    })
  );

  // Routes
  app.use(createHealthRouter());
  app.use(createStatusRouter(llmService, modelLoading, modelLoadError, sessionManager));
  app.use(createSessionsRouter(sessionManager));
  
  // Full analysis route (all analyses in parallel)
  app.post(
    '/api/analyze',
    requireModelReady(llmService, modelLoading, modelLoadError),
    validateAnalyzeRequest,
    createAnalyzeHandler(llmService, sessionManager)
  );

  // Individual analysis routes (each can be called independently)
  const modelReady = requireModelReady(llmService, modelLoading, modelLoadError);
  
  app.post(
    '/api/analyze/intent',
    modelReady,
    validateAnalyzeRequest,
    createIntentHandler(llmService, sessionManager)
  );

  app.post(
    '/api/analyze/tone',
    modelReady,
    validateAnalyzeRequest,
    createToneHandler(llmService, sessionManager)
  );

  app.post(
    '/api/analyze/impact',
    modelReady,
    validateAnalyzeRequest,
    createImpactHandler(llmService, sessionManager)
  );

  app.post(
    '/api/analyze/alternatives',
    modelReady,
    validateAnalyzeRequest,
    createAlternativesHandler(llmService, sessionManager)
  );

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}
