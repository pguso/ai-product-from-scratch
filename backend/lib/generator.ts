import {
  LlamaContextSequence,
  LlamaChatSession,
  LlamaJsonSchemaGrammar,
  QwenChatWrapper,
} from 'node-llama-cpp';
import type { ValidateFunction } from 'ajv';
import type { GenerationOptions } from './types.js';
import { formatValidationErrors, parseJSON } from './validation.js';
import type { LLMLogger } from './llm-logger.js';

/**
 * Detect if text appears to be truncated
 * 
 * Checks for common truncation patterns:
 * - Words ending with incomplete characters like "{", "[", etc.
 * - Sentences ending mid-word
 * - Incomplete JSON structures
 */
function isTruncated(text: string): boolean {
  if (!text || text.trim().length === 0) return false;
  
  const trimmed = text.trim();
  
  // Check for incomplete words (ending with special characters that shouldn't be at word end)
  const incompleteWordPattern = /[a-zA-Z][{[\]]$/;
  if (incompleteWordPattern.test(trimmed)) {
    return true;
  }
  
  // Check for incomplete sentences (ending with lowercase letter followed by nothing)
  // This catches cases like "making{" where the word is cut off
  const incompleteSentencePattern = /[a-z][{[\]]$/;
  if (incompleteSentencePattern.test(trimmed)) {
    return true;
  }
  
  // Check for incomplete JSON (unclosed brackets/braces at the end)
  const openBraces = (trimmed.match(/{/g) || []).length;
  const closeBraces = (trimmed.match(/}/g) || []).length;
  const openBrackets = (trimmed.match(/\[/g) || []).length;
  const closeBrackets = (trimmed.match(/\]/g) || []).length;
  
  // If we have unclosed structures at the end, it might be truncated
  if (openBraces > closeBraces || openBrackets > closeBrackets) {
    // But only if it ends with an opening character or incomplete structure
    if (trimmed.endsWith('{') || trimmed.endsWith('[') || trimmed.match(/[{[]\s*$/)) {
      return true;
    }
  }
  
  // Check for words ending with incomplete punctuation (like "making{")
  const incompleteWordEnd = /[a-zA-Z][{[\]]\s*$/;
  if (incompleteWordEnd.test(trimmed)) {
    return true;
  }
  
  return false;
}

/**
 * Validate and fix truncated text in analysis results
 * 
 * Recursively checks all string fields for truncation and throws error if found.
 * This ensures we catch truncation issues before they reach the user.
 */
function validateNoTruncation<T>(data: T, path: string = 'root'): void {
  if (typeof data === 'string') {
    if (isTruncated(data)) {
      throw new Error(`Truncated text detected at ${path}: "${data.substring(0, 50)}..."`);
    }
  } else if (Array.isArray(data)) {
    data.forEach((item, index) => {
      validateNoTruncation(item, `${path}[${index}]`);
    });
  } else if (data && typeof data === 'object') {
    Object.entries(data).forEach(([key, value]) => {
      validateNoTruncation(value, `${path}.${key}`);
    });
  }
}

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
  sessionId?: string;
  logger?: LLMLogger;
}

/**
 * Generate a response from the LLM with schema validation
 */
export async function generateWithSchema<T>(
  prompt: string,
  grammar: LlamaJsonSchemaGrammar,
  validator: ValidateFunction<T>,
  dependencies: GeneratorDependencies,
  options: GenerationOptions = {},
  analysisType?: 'intent' | 'tone' | 'impact' | 'alternatives'
): Promise<T> {
  const { contextSequence, contextSize, sessionId, logger } = dependencies;
  const { maxTokens, temperature = 0.7 } = options;
  const maxTokensToUse = maxTokens ?? contextSize;

  // Log request if logger is available
  if (logger && sessionId && analysisType) {
    await logger.logRequest(sessionId, analysisType, prompt, { temperature, maxTokens: maxTokensToUse });
  }

  // Create a more specific system prompt based on analysis type
  let systemPrompt = 'You are a communication analysis expert. Always respond with valid, complete JSON only. Generate all required items - do not return empty arrays or incomplete responses. CRITICAL: All text fields must be COMPLETE - never truncate mid-word or mid-sentence. Every field must end with complete words and proper punctuation.';

  if (analysisType === 'alternatives') {
    systemPrompt = 'You are a communication analysis expert specializing in rewriting messages. You MUST generate complete alternatives with ALL fields filled in. NEVER return empty strings ("") for any field. Every badge, text, reason, and tag must contain actual content. CRITICAL: All text fields must be COMPLETE - never truncate mid-word or mid-sentence. Always respond with valid, complete JSON only.';
  }

  // Create a new session for this generation
  const session = new LlamaChatSession({
    contextSequence,
    systemPrompt,
  });

  let response: string | undefined;
  try {
    // Generate with JSON schema grammar enforcement
    response = await session.prompt(prompt, {
      grammar,
      maxTokens: maxTokensToUse,
      temperature,
    });

    // Log response if logger is available
    if (logger && sessionId && analysisType && response) {
      await logger.logResponse(sessionId, analysisType, response);
    }

    // Parse using grammar (handles JSON parsing and validation)
    const parsed = grammar.parse(response) as T;

    // Additional validation with Ajv as safety net
    if (!validator(parsed)) {
      const errors = formatValidationErrors(validator.errors);
      console.warn('[LLM] Validation failed. Response:', JSON.stringify(parsed, null, 2));
      console.warn('[LLM] Validation errors:', errors);

      // Log validation error
      if (logger && sessionId && analysisType) {
        await logger.logError(sessionId, analysisType, `Validation failed: ${errors}`);
      }

      throw new Error(`Validation failed: ${errors}`);
    }

    // Check for truncation in the parsed response
    try {
      validateNoTruncation(parsed);
    } catch (truncationError) {
      const errorMsg = truncationError instanceof Error ? truncationError.message : String(truncationError);
      console.warn('[LLM] Truncation detected in response:', errorMsg);
      console.warn('[LLM] Truncated response:', JSON.stringify(parsed, null, 2).substring(0, 500));
      
      // Log truncation error
      if (logger && sessionId && analysisType) {
        await logger.logError(sessionId, analysisType, `Truncation detected: ${errorMsg}`);
      }
      
      throw new Error(`Response appears truncated: ${errorMsg}`);
    }

    return parsed;
  } catch (error) {
    // Log error if logger is available
    if (logger && sessionId && analysisType) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await logger.logError(sessionId, analysisType, errorMessage);
    }

    // If grammar parsing fails, try manual JSON parsing as fallback
    if (error instanceof Error && response) {
      console.warn('[LLM] Grammar parse failed, trying manual parse. Raw response:', response.substring(0, 500));
      try {
        const manualParsed = parseJSON<T>(response);
        if (validator(manualParsed)) {
          // Log successful manual parse
          if (logger && sessionId && analysisType) {
            await logger.logResponse(sessionId, analysisType, response, undefined);
          }
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
  buildRetryPrompt: (original: string, error: string) => string,
  analysisType?: 'intent' | 'tone' | 'impact' | 'alternatives'
): Promise<T> {
  const maxAttempts = 2;
  let lastError: Error | null = null;
  const { logger, sessionId } = dependencies;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const prompt =
        attempt === 1
          ? promptBuilder(message, context)
          : buildRetryPrompt(promptBuilder(message, context), lastError?.message || 'Unknown error');

      return await generateWithSchema<T>(prompt, grammar, validator, dependencies, options, analysisType);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`Attempt ${attempt}/${maxAttempts} failed:`, lastError.message);

      // Log retry attempt error
      if (logger && sessionId && analysisType) {
        await logger.logError(sessionId, analysisType, `Attempt ${attempt} failed: ${lastError.message}`, attempt);
      }

      if (attempt === maxAttempts) {
        throw new Error(`Failed after ${maxAttempts} attempts: ${lastError.message}`);
      }
    }
  }

  // TypeScript requires this, but it's unreachable
  throw lastError;
}
