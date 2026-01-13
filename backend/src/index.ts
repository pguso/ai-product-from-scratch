import 'dotenv/config';
import { config } from './config.js';
import { createApp } from './app.js';
import { getLLMService, getSessionManager } from '../lib/index.js';
import { startModelLoading } from './model-loader.js';

/**
 * Server Entry Point
 * 
 * Initializes services and starts the Express server.
 * Model loads asynchronously in the background.
 */

// Initialize services
const llmService = getLLMService({ modelPath: config.modelPath });
const sessionManager = getSessionManager();

// Model loading state
const modelState = {
  loading: false,
  error: null as Error | null,
};

// Start loading model in background (non-blocking)
startModelLoading(llmService, config.modelPath, modelState);

// Create Express app
const app = createApp(llmService, modelState.loading, modelState.error, sessionManager);

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Start server
app.listen(config.port, () => {
  console.log(`Backend server running on http://localhost:${config.port}`);
  console.log(`Model path: ${config.modelPath}`);
  console.log(`Model loading in background...`);
  console.log(`Check /api/status for model loading progress`);
  console.log(`OpenAPI documentation available at http://localhost:${config.port}/api-docs`);
});
