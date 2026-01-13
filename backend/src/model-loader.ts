import type { LLMService } from '../lib/llm-service.js';

/**
 * Model Loader
 * 
 * Handles asynchronous loading of the LLM model in the background.
 * This allows the server to start immediately while the model loads.
 */

interface ModelLoaderState {
  loading: boolean;
  error: Error | null;
}

/**
 * Initialize the model asynchronously (non-blocking)
 */
export async function initializeModel(
  llmService: LLMService,
  modelPath: string,
  state: ModelLoaderState
): Promise<void> {
  if (state.loading || llmService.initialized) {
    return;
  }

  state.loading = true;
  state.error = null;

  try {
    console.log(`Starting model initialization from: ${modelPath}`);
    await llmService.initialize();
    console.log('Model loaded successfully');
  } catch (error) {
    state.error = error instanceof Error ? error : new Error(String(error));
    console.error('Failed to load model:', state.error.message);
  } finally {
    state.loading = false;
  }
}

/**
 * Start loading the model in the background
 */
export function startModelLoading(
  llmService: LLMService,
  modelPath: string,
  state: ModelLoaderState
): void {
  initializeModel(llmService, modelPath, state).catch((error) => {
    console.error('Unexpected error during model initialization:', error);
  });
}
