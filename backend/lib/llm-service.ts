import {
  getLlama,
  Llama,
  LlamaModel,
  LlamaContext,
  LlamaContextSequence,
  LlamaJsonSchemaGrammar,
} from 'node-llama-cpp';
import Ajv, { ValidateFunction } from 'ajv';
import type {
  IntentAnalysis,
  ToneAnalysis,
  ImpactAnalysis,
  Alternative,
} from '@communication-mirror/shared';
import {
  intentSchema,
  toneSchema,
  impactSchema,
  alternativesSchema,
  llamaIntentSchema,
  llamaToneSchema,
  llamaImpactSchema,
  llamaAlternativesSchema,
} from './schemas.js';
import {
  buildIntentPrompt,
  buildTonePrompt,
  buildImpactPrompt,
  buildAlternativesPrompt,
  buildRetryPrompt,
} from './prompts.js';
import { generateWithRetry } from './generator.js';
import type { LLMServiceConfig, GenerationOptions } from './types.js';

/**
 * LLM Service
 * 
 * Manages the local LLM model and provides methods for analyzing communication.
 * 
 * Responsibilities:
 * - Loading and managing the GGUF model
 * - Creating JSON schema grammars for structured output
 * - Providing analysis methods (intent, tone, impact, alternatives)
 * - Handling validation and retry logic
 */
export class LLMService {
  private llama: Llama | null = null;
  private model: LlamaModel | null = null;
  private context: LlamaContext | null = null;
  private contextSequence: LlamaContextSequence | null = null;
  private config: LLMServiceConfig;
  private ajv: Ajv;
  private validators: {
    intent: ValidateFunction<IntentAnalysis>;
    tone: ValidateFunction<ToneAnalysis>;
    impact: ValidateFunction<ImpactAnalysis>;
    alternatives: ValidateFunction<Alternative[]>;
  };
  private grammars: {
    intent: LlamaJsonSchemaGrammar | null;
    tone: LlamaJsonSchemaGrammar | null;
    impact: LlamaJsonSchemaGrammar | null;
    alternatives: LlamaJsonSchemaGrammar | null;
  };
  private isInitialized = false;

  constructor(config: LLMServiceConfig) {
    this.config = {
      contextSize: 4096,
      gpuLayers: 0,
      ...config,
    };

    // Initialize Ajv validators
    this.ajv = new Ajv({ allErrors: true });
    this.validators = {
      intent: this.ajv.compile(intentSchema),
      tone: this.ajv.compile(toneSchema),
      impact: this.ajv.compile(impactSchema),
      alternatives: this.ajv.compile(alternativesSchema),
    };

    // Grammars will be created after model is loaded
    this.grammars = {
      intent: null,
      tone: null,
      impact: null,
      alternatives: null,
    };
  }

  // ---------------------------------------------------------------------------
  // Initialization
  // ---------------------------------------------------------------------------

  /**
   * Initialize the LLM service
   * 
   * Loads the model and creates JSON schema grammars for structured output.
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    console.log('Initializing LLM service...');
    console.log(`Loading model from: ${this.config.modelPath}`);

    this.llama = await getLlama();

    this.model = await this.llama.loadModel({
      modelPath: this.config.modelPath,
    });

    this.context = await this.model.createContext({
      contextSize: this.config.contextSize,
    });

    this.contextSequence = this.context.getSequence();

    // Create grammars for JSON schema enforcement
    console.log('Creating JSON schema grammars...');
    this.grammars.intent = await this.llama.createGrammarForJsonSchema(llamaIntentSchema);
    this.grammars.tone = await this.llama.createGrammarForJsonSchema(llamaToneSchema);
    this.grammars.impact = await this.llama.createGrammarForJsonSchema(llamaImpactSchema);
    this.grammars.alternatives = await this.llama.createGrammarForJsonSchema(llamaAlternativesSchema);

    this.isInitialized = true;
    console.log('LLM service initialized successfully');
  }

  /**
   * Dispose of resources
   */
  async dispose(): Promise<void> {
    if (this.context) {
      await this.context.dispose();
      this.context = null;
    }
    if (this.model) {
      await this.model.dispose();
      this.model = null;
    }
    this.llama = null;
    this.contextSequence = null;
    this.grammars = {
      intent: null,
      tone: null,
      impact: null,
      alternatives: null,
    };
    this.isInitialized = false;
    console.log('LLM service disposed');
  }

  // ---------------------------------------------------------------------------
  // Public Analysis Methods
  // ---------------------------------------------------------------------------

  /**
   * Analyze the intent of a message
   */
  async analyzeIntent(message: string, context?: string): Promise<IntentAnalysis> {
    this.ensureInitialized('intent');
    return this.generateAnalysis(
      buildIntentPrompt,
      this.grammars.intent!,
      this.validators.intent,
      message,
      context,
      { temperature: 0.5 }
    );
  }

  /**
   * Analyze the tone of a message
   */
  async analyzeTone(message: string, context?: string): Promise<ToneAnalysis> {
    this.ensureInitialized('tone');
    return this.generateAnalysis(
      buildTonePrompt,
      this.grammars.tone!,
      this.validators.tone,
      message,
      context,
      { temperature: 0.6 }
    );
  }

  /**
   * Predict the impact on the recipient
   */
  async predictImpact(message: string, context?: string): Promise<ImpactAnalysis> {
    this.ensureInitialized('impact');
    return this.generateAnalysis(
      buildImpactPrompt,
      this.grammars.impact!,
      this.validators.impact,
      message,
      context,
      { temperature: 0.5 }
    );
  }

  /**
   * Generate alternative phrasings
   */
  async generateAlternatives(message: string, context?: string): Promise<Alternative[]> {
    this.ensureInitialized('alternatives');
    return this.generateAnalysis(
      buildAlternativesPrompt,
      this.grammars.alternatives!,
      this.validators.alternatives,
      message,
      context,
      { temperature: 0.6, maxTokens: 6000 }
    );
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  /**
   * Generate analysis using the generator with retry logic
   */
  private async generateAnalysis<T>(
    promptBuilder: (message: string, context?: string) => string,
    grammar: LlamaJsonSchemaGrammar,
    validator: ValidateFunction<T>,
    message: string,
    context: string | undefined,
    options: GenerationOptions
  ): Promise<T> {
    if (!this.contextSequence || !this.context) {
      throw new Error('LLM service not initialized. Call initialize() first.');
    }

    return generateWithRetry(
      promptBuilder,
      grammar,
      validator,
      message,
      {
        contextSequence: this.contextSequence,
        contextSize: this.context.contextSize,
      },
      context,
      options,
      buildRetryPrompt
    );
  }

  /**
   * Ensure the service and specific grammar are initialized
   */
  private ensureInitialized(type: 'intent' | 'tone' | 'impact' | 'alternatives'): void {
    if (!this.isInitialized || !this.grammars[type]) {
      throw new Error('LLM service not initialized. Call initialize() first.');
    }
  }

  // ---------------------------------------------------------------------------
  // Status
  // ---------------------------------------------------------------------------

  get initialized(): boolean {
    return this.isInitialized;
  }

  get modelPath(): string {
    return this.config.modelPath;
  }
}

// =============================================================================
// Factory Function
// =============================================================================

let serviceInstance: LLMService | null = null;

/**
 * Get or create the LLM service singleton
 */
export function getLLMService(config?: LLMServiceConfig): LLMService {
  if (!serviceInstance) {
    if (!config) {
      throw new Error('LLM service not initialized. Provide config on first call.');
    }
    serviceInstance = new LLMService(config);
  }
  return serviceInstance;
}

/**
 * Reset the service (useful for testing or reconfiguration)
 */
export async function resetLLMService(): Promise<void> {
  if (serviceInstance) {
    await serviceInstance.dispose();
    serviceInstance = null;
  }
}
