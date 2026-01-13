import type { JSONSchemaType } from 'ajv';
import type {
  IntentAnalysis,
  ToneAnalysis,
  ImpactAnalysis,
  Alternative,
} from '@shared';

// =============================================================================
// JSON Schemas for LLM Output Validation
// =============================================================================

/**
 * Schema for Intent Analysis
 * Validates: { primary, secondary, implicit }
 */
export const intentSchema: JSONSchemaType<IntentAnalysis> = {
  type: 'object',
  properties: {
    primary: { type: 'string', minLength: 1 },
    secondary: { type: 'string', minLength: 1 },
    implicit: { type: 'string', minLength: 1 },
  },
  required: ['primary', 'secondary', 'implicit'],
  additionalProperties: false,
};

/**
 * Schema for Tone Analysis
 * Validates: { summary, emotions[], details }
 */
export const toneSchema: JSONSchemaType<ToneAnalysis> = {
  type: 'object',
  properties: {
    summary: { type: 'string', minLength: 1 },
    emotions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string', minLength: 1 },
          sentiment: { type: 'string', enum: ['positive', 'neutral', 'negative'] },
        },
        required: ['text', 'sentiment'],
        additionalProperties: false,
      },
      minItems: 1,
    },
    details: { type: 'string', minLength: 1 },
  },
  required: ['summary', 'emotions', 'details'],
  additionalProperties: false,
};

/**
 * Schema for Impact Analysis
 * Validates: { metrics[], recipientResponse }
 */
export const impactSchema: JSONSchemaType<ImpactAnalysis> = {
  type: 'object',
  properties: {
    metrics: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { 
            type: 'string', 
            minLength: 1,
            enum: [
              'Emotional Friction',
              'Defensive Response Likelihood',
              'Relationship Strain',
              'Cooperation Likelihood'
            ]
          },
          value: { type: 'integer', minimum: 0, maximum: 100 },
          category: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
        required: ['name', 'value', 'category'],
        additionalProperties: false,
      },
      minItems: 4,
      maxItems: 4,
    },
    recipientResponse: { type: 'string', minLength: 1 },
  },
  required: ['metrics', 'recipientResponse'],
  additionalProperties: false,
};

/**
 * Schema for Alternative Suggestions
 * Validates: Alternative[]
 */
export const alternativesSchema: JSONSchemaType<Alternative[]> = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      badge: { type: 'string', minLength: 1 },
      text: { type: 'string', minLength: 1 },
      reason: { type: 'string', minLength: 1 },
      tags: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            text: { type: 'string', minLength: 1 },
            isPositive: { type: 'boolean' },
          },
          required: ['text', 'isPositive'],
          additionalProperties: false,
        },
        minItems: 1,
      },
    },
    required: ['badge', 'text', 'reason', 'tags'],
    additionalProperties: false,
  },
  minItems: 1,
  maxItems: 5,
};

// =============================================================================
// node-llama-cpp Grammar Schemas (for structured output)
// =============================================================================

/**
 * These are simplified schema objects for node-llama-cpp's JSON grammar.
 * They enforce structure during generation, not just validation.
 */

export const llamaIntentSchema = {
  type: 'object',
  properties: {
    primary: { type: 'string' },
    secondary: { type: 'string' },
    implicit: { type: 'string' },
  },
  required: ['primary', 'secondary', 'implicit'],
} as const;

export const llamaToneSchema = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    emotions: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          sentiment: { type: 'string', enum: ['positive', 'neutral', 'negative'] },
        },
        required: ['text', 'sentiment'],
      },
    },
    details: { type: 'string' },
  },
  required: ['summary', 'emotions', 'details'],
} as const;

export const llamaImpactSchema = {
  type: 'object',
  properties: {
    metrics: {
      type: 'array',
      minItems: 4,
      maxItems: 4,
      items: {
        type: 'object',
        properties: {
          name: { 
            type: 'string',
            enum: [
              'Emotional Friction',
              'Defensive Response Likelihood',
              'Relationship Strain',
              'Cooperation Likelihood'
            ]
          },
          value: { type: 'integer' },
          category: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
        required: ['name', 'value', 'category'],
      },
    },
    recipientResponse: { type: 'string' },
  },
  required: ['metrics', 'recipientResponse'],
} as const;

export const llamaAlternativesSchema = {
  type: 'array',
  minItems: 3,
  maxItems: 3,
  items: {
    type: 'object',
    properties: {
      badge: { type: 'string' },
      text: { type: 'string' },
      reason: { type: 'string' },
      tags: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          properties: {
            text: { type: 'string' },
            isPositive: { type: 'boolean' },
          },
          required: ['text', 'isPositive'],
        },
      },
    },
    required: ['badge', 'text', 'reason', 'tags'],
  },
} as const;
