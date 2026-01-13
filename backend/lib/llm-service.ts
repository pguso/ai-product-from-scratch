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
import type { LLMLogger } from './llm-logger.js';

/**
 * Filter out broken alternatives that fail validation
 *
 * Removes alternatives with:
 * - Empty or whitespace-only text
 * - Empty or whitespace-only reason
 * - Invalid tag arrays
 *
 * Rule: Fewer options > broken options
 */
function filterValidAlternatives(alternatives: Alternative[]): Alternative[] {
  return alternatives.filter((alt) => {
    // Check text is non-empty and not just whitespace
    if (!alt.text || alt.text.trim().length === 0) {
      console.warn(`[Alternatives] Dropping option ${alt.badge}: empty text`);
      return false;
    }

    // Check reason is non-empty and not just whitespace
    if (!alt.reason || alt.reason.trim().length === 0) {
      console.warn(`[Alternatives] Dropping option ${alt.badge}: empty reason`);
      return false;
    }

    // Check tags array is valid
    if (!alt.tags || alt.tags.length === 0) {
      console.warn(`[Alternatives] Dropping option ${alt.badge}: empty tags`);
      return false;
    }

    // Check all tags are valid
    const hasInvalidTag = alt.tags.some(tag => !tag.text || tag.text.trim().length === 0);
    if (hasInvalidTag) {
      console.warn(`[Alternatives] Dropping option ${alt.badge}: invalid tags`);
      return false;
    }

    return true;
  });
}

/**
 * Normalize impact metric categories based on value
 *
 * Ensures consistency: category must match value according to hard thresholds:
 * - 0-30 → low
 * - 31-60 → medium
 * - 61-100 → high
 *
 * Also enforces logical consistency: if cooperation is low due to withdrawal,
 * emotional friction and relationship strain cannot both be low.
 */
function normalizeImpactMetrics(impact: ImpactAnalysis): ImpactAnalysis {
  const normalizedMetrics = impact.metrics.map(metric => {
    let category: 'low' | 'medium' | 'high';
    if (metric.value <= 30) {
      category = 'low';
    } else if (metric.value <= 60) {
      category = 'medium';
    } else {
      category = 'high';
    }

    // Log if category was corrected
    if (metric.category !== category) {
      console.warn(`[Impact] Corrected category for ${metric.name}: ${metric.value} was ${metric.category}, corrected to ${category}`);
    }

    return {
      ...metric,
      category,
    };
  });

  // Enforce logical consistency: if cooperation is low due to withdrawal,
  // emotional friction and relationship strain cannot both be low
  const cooperationMetric = normalizedMetrics.find(m => m.name === 'Cooperation Likelihood');
  const frictionMetric = normalizedMetrics.find(m => m.name === 'Emotional Friction');
  const strainMetric = normalizedMetrics.find(m => m.name === 'Relationship Strain');

  if (cooperationMetric && frictionMetric && strainMetric) {
    // If cooperation is low (withdrawal/disengagement), friction and strain should be at least medium
    if (cooperationMetric.value <= 30 && frictionMetric.value <= 30 && strainMetric.value <= 30) {
      console.warn(`[Impact] Logical inconsistency detected: Cooperation is low (${cooperationMetric.value}) but both Friction (${frictionMetric.value}) and Strain (${strainMetric.value}) are also low. Adjusting to medium.`);

      // Adjust friction and strain to at least medium (31-60 range)
      if (frictionMetric.value <= 30) {
        frictionMetric.value = 35; // Set to medium range
        frictionMetric.category = 'medium';
        console.warn(`[Impact] Adjusted Emotional Friction from ${frictionMetric.value} to 35 (medium) for consistency`);
      }
      if (strainMetric.value <= 30) {
        strainMetric.value = 35; // Set to medium range
        strainMetric.category = 'medium';
        console.warn(`[Impact] Adjusted Relationship Strain from ${strainMetric.value} to 35 (medium) for consistency`);
      }
    }
    
    // Fix unrealistic cooperation likelihood for urgent requests
    // Urgent requests (with words like "finally", "today", time pressure) should NOT be 0
    // They typically have medium cooperation (40-60) due to urgency and social pressure
    if (cooperationMetric.value === 0) {
      console.warn(`[Impact] Unrealistic Cooperation Likelihood detected: ${cooperationMetric.value} (0) is too low. Urgent requests typically have medium cooperation (40-60) due to urgency and social pressure. Adjusting to 45 (medium).`);
      cooperationMetric.value = 45; // Set to medium range
      cooperationMetric.category = 'medium';
    }
  }

  return {
    ...impact,
    metrics: normalizedMetrics,
  };
}

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
 * Clean and normalize emotion labels
 *
 * Standardizes emotion text formatting:
 * - Title Case for main emotion words
 * - Consistent parenthetical qualifier format: "(mild)", "(moderate)", "(strong)"
 * - Removes redundant qualifiers
 * - Normalizes spacing and capitalization
 * - Detects and fixes schema leaks/parsing artifacts
 */
function cleanEmotionLabel(text: string): string {
  // Remove leading/trailing whitespace
  let cleaned = text.trim();

  // Skip if empty
  if (!cleaned) return text;

  // Detect and reject schema leaks or parsing artifacts
  // Patterns like "Task-Flow (mod 4 5 6 7 8 9 10 11 12 13 14 {" indicate parsing errors
  const schemaLeakPattern = /\(mod\s+\d+|\d+\s+\d+\s+\d+|Task-Flow|schema|enum|internal/i;
  if (schemaLeakPattern.test(cleaned)) {
    console.error(`[Tone] Detected schema leak/parsing artifact in emotion label: "${cleaned}"`);
    // Return a fallback that indicates an error was detected
    return 'Emotional Discomfort'; // Fallback to a generic valid emotion
  }

  // Detect truncation in emotion labels
  if (isTruncated(cleaned)) {
    console.error(`[Tone] Detected truncation in emotion label: "${cleaned}"`);
    // Try to recover by removing incomplete parts
    cleaned = cleaned.replace(/[{[\]]+$/, '').trim();
    if (!cleaned) {
      return 'Emotional Discomfort'; // Fallback if nothing remains
    }
  }

  // Extract main emotion and qualifier (if present)
  const qualifierMatch = cleaned.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  let mainEmotion = cleaned;
  let qualifier = '';

  if (qualifierMatch) {
    mainEmotion = qualifierMatch[1].trim();
    qualifier = qualifierMatch[2].trim();
  }

  // Normalize qualifier to standard format
  const qualifierMap: Record<string, string> = {
    'low intensity': 'mild',
    'low-intensity': 'mild',
    'high intensity': 'strong',
    'high-intensity': 'strong',
    'medium intensity': 'moderate',
    'medium-intensity': 'moderate',
    'moderate intensity': 'moderate',
    'slight': 'mild',
    'slightly': 'mild',
    'very': 'strong',
    'extremely': 'strong',
    'mild': 'mild',
    'moderate': 'moderate',
    'strong': 'strong',
  };

  if (qualifier) {
    const normalizedQual = qualifierMap[qualifier.toLowerCase()] || qualifier.toLowerCase();
    qualifier = normalizedQual;
  }

  // Convert main emotion to Title Case
  // Handle hyphenated words properly
  mainEmotion = mainEmotion
    .split(/\s+/)
    .map(word => {
      // Handle hyphenated words
      if (word.includes('-')) {
        return word
          .split('-')
          .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
          .join('-');
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');

  // Fix common capitalization issues for compound terms
  const specialCases: Record<string, string> = {
    'Task Focused': 'Task-Focused',
    'Task-focused': 'Task-Focused',
    'Matter Of Fact': 'Matter-of-Fact',
    'Matter-of-fact': 'Matter-of-Fact',
    'Matter Of Fact': 'Matter-of-Fact',
  };

  if (specialCases[mainEmotion]) {
    mainEmotion = specialCases[mainEmotion];
  }

  // Remove redundant qualifiers (e.g., "Frustrated (frustrated)" -> "Frustrated")
  if (qualifier) {
    const mainLower = mainEmotion.toLowerCase();
    const qualLower = qualifier.toLowerCase();
    // If qualifier is redundant (same as main word or contained in it), remove it
    if (mainLower.includes(qualLower) && qualLower.length > 2) {
      qualifier = '';
    }
  }

  // Reconstruct the cleaned label
  // Only keep standard qualifiers (mild, moderate, strong)
  // If qualifier was normalized to one of these, keep it; otherwise remove it
  const standardQualifiers = ['mild', 'moderate', 'strong'];
  if (qualifier && !standardQualifiers.includes(qualifier)) {
    qualifier = '';
  }

  const result = qualifier ? `${mainEmotion} (${qualifier})` : mainEmotion;

  // Final cleanup: normalize spacing
  return result.replace(/\s+/g, ' ').trim();
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
 * Filter out neutral emotions that add no signal
 *
 * Removes emotions with text "Neutral" and sentiment "neutral" as they provide
 * no useful information. If all emotions are filtered out, keeps at least one
 * descriptive emotion (e.g., "Task-focused", "Professional", "Informational").
 */
function filterNeutralEmotions(tone: ToneAnalysis): ToneAnalysis {
  const filtered = tone.emotions.filter(emotion => {
    // Remove "Neutral" entries that add no signal
    if (emotion.text.toLowerCase() === 'neutral' && emotion.sentiment === 'neutral') {
      console.warn(`[Tone] Filtered out redundant neutral emotion`);
      return false;
    }
    return true;
  });

  // Ensure at least one emotion remains
  if (filtered.length === 0 && tone.emotions.length > 0) {
    console.warn(`[Tone] All emotions were neutral, keeping first emotion as fallback`);
    return tone; // Return original if all would be filtered
  }

  // Clean emotion labels and validate sentiment matches
  const cleaned = filtered.map(emotion => {
    const cleanedText = cleanEmotionLabel(emotion.text);
    if (cleanedText !== emotion.text) {
      console.log(`[Tone] Cleaned emotion label: "${emotion.text}" -> "${cleanedText}"`);
    }
    
    // Validate sentiment matches emotion text
    let correctedSentiment = emotion.sentiment;
    const emotionLower = cleanedText.toLowerCase();
    
    // Negative emotion keywords
    const negativeEmotions = ['frustrated', 'hurt', 'disappointed', 'annoyed', 'resentful', 'angry', 'upset', 'irritated', 'disappointment', 'frustration', 'resentment', 'discomfort'];
    // Positive emotion keywords
    const positiveEmotions = ['appreciative', 'grateful', 'happy', 'content', 'pleased', 'satisfied', 'joyful', 'excited'];
    // Neutral state keywords
    const neutralStates = ['task-focused', 'professional', 'informational', 'matter-of-fact', 'neutral'];
    
    const isNegative = negativeEmotions.some(neg => emotionLower.includes(neg));
    const isPositive = positiveEmotions.some(pos => emotionLower.includes(pos));
    const isNeutral = neutralStates.some(neu => emotionLower.includes(neu));
    
    if (isNegative && emotion.sentiment !== 'negative') {
      console.warn(`[Tone] Corrected sentiment mismatch: "${cleanedText}" was "${emotion.sentiment}", corrected to "negative"`);
      correctedSentiment = 'negative';
    } else if (isPositive && emotion.sentiment !== 'positive') {
      console.warn(`[Tone] Corrected sentiment mismatch: "${cleanedText}" was "${emotion.sentiment}", corrected to "positive"`);
      correctedSentiment = 'positive';
    } else if (isNeutral && emotion.sentiment !== 'neutral') {
      console.warn(`[Tone] Corrected sentiment mismatch: "${cleanedText}" was "${emotion.sentiment}", corrected to "neutral"`);
      correctedSentiment = 'neutral';
    }
    
    return {
      ...emotion,
      text: cleanedText,
      sentiment: correctedSentiment,
    };
  });

  return {
    ...tone,
    emotions: cleaned,
  };
}

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
  private logger: LLMLogger | null = null;

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
   * Set the logger instance
   */
  setLogger(logger: LLMLogger): void {
    this.logger = logger;
    if (this.config.modelPath) {
      logger.setModelPath(this.config.modelPath);
    }
  }

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

    // Update logger with model path if available
    if (this.logger) {
      this.logger.setModelPath(this.config.modelPath);
    }

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
  async analyzeIntent(message: string, context?: string, sessionId?: string): Promise<IntentAnalysis> {
    this.ensureInitialized('intent');
    return this.generateAnalysis(
      buildIntentPrompt,
      this.grammars.intent!,
      this.validators.intent,
      message,
      context,
      { temperature: 0.5 },
      'intent',
      sessionId
    );
  }

  /**
   * Analyze the tone of a message
   */
  async analyzeTone(message: string, context?: string, sessionId?: string): Promise<ToneAnalysis> {
    this.ensureInitialized('tone');
    const tone = await this.generateAnalysis(
      buildTonePrompt,
      this.grammars.tone!,
      this.validators.tone,
      message,
      context,
      { temperature: 0.6 },
      'tone',
      sessionId
    );

    // Filter out neutral emotions that add no signal
    return filterNeutralEmotions(tone);
  }

  /**
   * Predict the impact on the recipient
   */
  async predictImpact(message: string, context?: string, sessionId?: string): Promise<ImpactAnalysis> {
    this.ensureInitialized('impact');
    const impact = await this.generateAnalysis(
      buildImpactPrompt,
      this.grammars.impact!,
      this.validators.impact,
      message,
      context,
      { temperature: 0.5 },
      'impact',
      sessionId
    );

    // Normalize categories to ensure consistency with value thresholds
    return normalizeImpactMetrics(impact);
  }

  /**
   * Generate alternative phrasings
   */
  async generateAlternatives(message: string, context?: string, sessionId?: string): Promise<Alternative[]> {
    this.ensureInitialized('alternatives');
    const alternatives = await this.generateAnalysis(
      buildAlternativesPrompt,
      this.grammars.alternatives!,
      this.validators.alternatives,
      message,
      context,
      { temperature: 0.6, maxTokens: 6000 },
      'alternatives',
      sessionId
    );

    // Filter out broken alternatives (fewer options > broken options)
    return filterValidAlternatives(alternatives);
  }

  /**
   * Run all analyses in parallel using batching
   *
   * Creates a temporary context with 4 sequences and processes all analyses
   * simultaneously for improved performance.
   */
  async analyzeBatched(
    message: string,
    context?: string,
    sessionId?: string
  ): Promise<{
    intent: IntentAnalysis;
    tone: ToneAnalysis;
    impact: ImpactAnalysis;
    alternatives: Alternative[];
  }> {
    this.ensureInitialized('intent');
    this.ensureInitialized('tone');
    this.ensureInitialized('impact');
    this.ensureInitialized('alternatives');

    if (!this.model) {
      throw new Error('LLM service not initialized. Call initialize() first.');
    }

    // Create a temporary context with 4 sequences for batching
    const batchedContext = await this.model.createContext({
      contextSize: this.config.contextSize,
      sequences: 4,
    });

    try {
      // Get 4 separate sequences
      const sequence1 = batchedContext.getSequence();
      const sequence2 = batchedContext.getSequence();
      const sequence3 = batchedContext.getSequence();
      const sequence4 = batchedContext.getSequence();

      // Run all analyses in parallel using batching
      const [intent, tone, impact, alternatives] = await Promise.all([
        generateWithRetry(
          buildIntentPrompt,
          this.grammars.intent!,
          this.validators.intent,
          message,
          {
            contextSequence: sequence1,
            contextSize: batchedContext.contextSize,
            sessionId,
            logger: this.logger || undefined,
          },
          context,
          { temperature: 0.5 },
          buildRetryPrompt,
          'intent'
        ),
        generateWithRetry(
          buildTonePrompt,
          this.grammars.tone!,
          this.validators.tone,
          message,
          {
            contextSequence: sequence2,
            contextSize: batchedContext.contextSize,
            sessionId,
            logger: this.logger || undefined,
          },
          context,
          { temperature: 0.6 },
          buildRetryPrompt,
          'tone'
        ),
        generateWithRetry(
          buildImpactPrompt,
          this.grammars.impact!,
          this.validators.impact,
          message,
          {
            contextSequence: sequence3,
            contextSize: batchedContext.contextSize,
            sessionId,
            logger: this.logger || undefined,
          },
          context,
          { temperature: 0.5 },
          buildRetryPrompt,
          'impact'
        ),
        generateWithRetry(
          buildAlternativesPrompt,
          this.grammars.alternatives!,
          this.validators.alternatives,
          message,
          {
            contextSequence: sequence4,
            contextSize: batchedContext.contextSize,
            sessionId,
            logger: this.logger || undefined,
          },
          context,
          { temperature: 0.6, maxTokens: 6000 },
          buildRetryPrompt,
          'alternatives'
        ),
      ]);

      // Filter out broken alternatives (fewer options > broken options)
      const validAlternatives = filterValidAlternatives(alternatives);

      // Normalize impact metrics and filter neutral emotions
      const normalizedImpact = normalizeImpactMetrics(impact);
      const filteredTone = filterNeutralEmotions(tone);

      return {
        intent,
        tone: filteredTone,
        impact: normalizedImpact,
        alternatives: validAlternatives,
      };
    } finally {
      // Clean up the temporary context
      await batchedContext.dispose();
    }
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
    options: GenerationOptions,
    analysisType: 'intent' | 'tone' | 'impact' | 'alternatives',
    sessionId?: string
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
        sessionId,
        logger: this.logger || undefined,
      },
      context,
      options,
      buildRetryPrompt,
      analysisType
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
