/**
 * LLM Service Types
 * 
 * Type definitions for the LLM service configuration and options.
 */

export interface LLMServiceConfig {
  modelPath: string;
  contextSize?: number;
  gpuLayers?: number;
}

export interface GenerationOptions {
  maxTokens?: number;
  temperature?: number;
}

export type AnalysisType = 'intent' | 'tone' | 'impact' | 'alternatives';
