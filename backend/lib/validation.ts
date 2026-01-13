import Ajv from 'ajv';

/**
 * Validation Utilities
 * 
 * Helper functions for validating and formatting validation errors.
 */

/**
 * Format Ajv validation errors into a readable string
 */
export function formatValidationErrors(errors: Ajv['errors']): string {
  if (!errors || errors.length === 0) {
    return 'Unknown validation error';
  }

  return errors
    .map((e) => {
      const path = e.instancePath || 'root';
      return `${path}: ${e.message}`;
    })
    .join('; ');
}

/**
 * Clean and parse JSON from LLM output
 * 
 * Handles common issues like markdown code blocks.
 */
export function parseJSON<T>(text: string): T {
  let cleaned = text.trim();

  // Remove markdown code blocks if present
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }

  cleaned = cleaned.trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch (error) {
    throw new Error(
      `Failed to parse JSON: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
