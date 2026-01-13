import {
  LlamaContextSequence,
  LlamaChatSession,
  LlamaJsonSchemaGrammar,
  QwenChatWrapper,
} from 'node-llama-cpp';
import type { ValidateFunction } from 'ajv';
import type { GenerationOptions } from './types.js';
import { formatValidationErrors, parseJSON } from './validation.js';

/**
 * LLM Generator
 * 
 * Core generation logic for creating LLM responses with:
 * - JSON schema grammar enforcement
 * - Response validation
 * - Error handling and fallback parsing
 */

interface GeneratorDependencies {
  contextSequence: LlamaContextSequence;
  contextSize: number;
}

/**
 * Generate a response from the LLM with schema validation
 */
export async function generateWithSchema<T>(
  prompt: string,
  grammar: LlamaJsonSchemaGrammar,
  validator: ValidateFunction<T>,
  dependencies: GeneratorDependencies,
  options: GenerationOptions = {}
): Promise<T> {
  const { contextSequence, contextSize } = dependencies;
  const { maxTokens, temperature = 0.7 } = options;
  const maxTokensToUse = maxTokens ?? contextSize;

  // Create a new session for this generation
  const session = new LlamaChatSession({
    contextSequence,
    systemPrompt:
      'You are a communication analysis expert. Always respond with valid, complete JSON only. Generate all required items - do not return empty arrays or incomplete responses.',
    chatWrapper: new QwenChatWrapper({
      thoughts: 'discourage',
    }),
  });

  let response: string | undefined;
  try {
    // Generate with JSON schema grammar enforcement
    response = await session.prompt(prompt, {
      grammar,
      maxTokens: maxTokensToUse,
      temperature,
    });

    // Parse using grammar (handles JSON parsing and validation)
    const parsed = grammar.parse(response) as T;

    // Additional validation with Ajv as safety net
    if (!validator(parsed)) {
      const errors = formatValidationErrors(validator.errors);
      console.warn('[LLM] Validation failed. Response:', JSON.stringify(parsed, null, 2));
      console.warn('[LLM] Validation errors:', errors);
      throw new Error(`Validation failed: ${errors}`);
    }

    return parsed;
  } catch (error) {
    // If grammar parsing fails, try manual JSON parsing as fallback
    if (error instanceof Error && response) {
      console.warn('[LLM] Grammar parse failed, trying manual parse. Raw response:', response.substring(0, 500));
      try {
        const manualParsed = parseJSON<T>(response);
        if (validator(manualParsed)) {
          return manualParsed;
        } else {
          const errors = formatValidationErrors(validator.errors);
          console.warn('[LLM] Manual parse validation failed:', errors);
          console.warn('[LLM] Parsed object:', JSON.stringify(manualParsed, null, 2));
        }
      } catch (parseError) {
        console.warn('[LLM] Manual parse also failed:', parseError);
        // Fall through to throw original error
      }
    }
    throw error;
  }
}

/**
 * Generate with retry logic
 * 
 * Attempts generation up to maxAttempts times, providing error feedback
 * to the LLM on retry attempts.
 */
export async function generateWithRetry<T>(
  promptBuilder: (message: string, context?: string) => string,
  grammar: LlamaJsonSchemaGrammar,
  validator: ValidateFunction<T>,
  message: string,
  dependencies: GeneratorDependencies,
  context?: string,
  options: GenerationOptions = {},
  buildRetryPrompt: (original: string, error: string) => string
): Promise<T> {
  const maxAttempts = 2;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const prompt =
        attempt === 1
          ? promptBuilder(message, context)
          : buildRetryPrompt(promptBuilder(message, context), lastError?.message || 'Unknown error');

      return await generateWithSchema<T>(prompt, grammar, validator, dependencies, options);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`Attempt ${attempt}/${maxAttempts} failed:`, lastError.message);

      if (attempt === maxAttempts) {
        throw new Error(`Failed after ${maxAttempts} attempts: ${lastError.message}`);
      }
    }
  }

  // TypeScript requires this, but it's unreachable
  throw lastError;
}
