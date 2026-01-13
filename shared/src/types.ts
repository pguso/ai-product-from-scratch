// =============================================================================
// Domain Types for Communication Analysis
// =============================================================================

// -----------------------------------------------------------------------------
// Intent Detection
// -----------------------------------------------------------------------------

export interface IntentAnalysis {
  primary: string;
  secondary: string;
  implicit: string;
}

// -----------------------------------------------------------------------------
// Tone Analysis
// -----------------------------------------------------------------------------

export type Sentiment = 'positive' | 'neutral' | 'negative';

export interface Emotion {
  text: string;
  sentiment: Sentiment;
}

export interface ToneAnalysis {
  summary: string;
  emotions: Emotion[];
  details: string;
}

// -----------------------------------------------------------------------------
// Impact Prediction
// -----------------------------------------------------------------------------

export type ImpactCategory = 'low' | 'medium' | 'high';

export interface ImpactMetric {
  name: string;
  value: number; // 0-100
  category: ImpactCategory;
}

export interface ImpactAnalysis {
  metrics: ImpactMetric[];
  recipientResponse: string;
}

// -----------------------------------------------------------------------------
// Alternative Suggestions
// -----------------------------------------------------------------------------

export interface AlternativeTag {
  text: string;
  isPositive: boolean;
}

export interface Alternative {
  badge: string;
  text: string;
  reason: string;
  tags: AlternativeTag[];
}

// -----------------------------------------------------------------------------
// Complete Analysis Result
// -----------------------------------------------------------------------------

export interface AnalysisResult {
  intent: IntentAnalysis;
  tone: ToneAnalysis;
  impact: ImpactAnalysis;
  alternatives: Alternative[];
}

// =============================================================================
// API Types
// =============================================================================

// -----------------------------------------------------------------------------
// Request
// -----------------------------------------------------------------------------

export interface AnalyzeRequest {
  message: string;
  sessionId?: string; // Optional session ID for conversation context
}

// -----------------------------------------------------------------------------
// Response
// -----------------------------------------------------------------------------

export interface AnalyzeResponse {
  success: true;
  data: AnalysisResult;
  sessionId: string; // Session ID for conversation context
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: string;
  };
}

export type ApiResponse = AnalyzeResponse | ErrorResponse;

// =============================================================================
// Utility Types (for LLM output validation)
// =============================================================================

/**
 * Partial analysis result for streaming/incremental updates
 */
export type PartialAnalysisResult = Partial<AnalysisResult>;

/**
 * Type guard to check if response is successful
 */
export function isSuccessResponse(response: ApiResponse): response is AnalyzeResponse {
  return response.success === true;
}

/**
 * Type guard to check if response is an error
 */
export function isErrorResponse(response: ApiResponse): response is ErrorResponse {
  return response.success === false;
}
