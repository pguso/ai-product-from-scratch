// Analysis Request/Response Types

export interface AnalyzeRequest {
  message: string;
}

export interface AnalyzeResponse {
  intent: IntentAnalysis;
  tone: ToneAnalysis;
  impact: ImpactAnalysis;
  alternatives: Alternative[];
}

// Intent Detection

export interface IntentAnalysis {
  primary: string;
  secondary: string;
  implicit: string;
}

// Tone Analysis

export type EmotionCategory = 'positive' | 'neutral' | 'negative';

export interface EmotionTag {
  label: string;
  category: EmotionCategory;
}

export interface ToneAnalysis {
  summary: string;
  emotions: EmotionTag[];
  details: string;
}

// Recipient Impact

export type ImpactLevel = 'low' | 'medium' | 'high';

export interface ImpactMetric {
  name: string;
  value: number; // 0-100
  level: ImpactLevel;
}

export interface ImpactAnalysis {
  metrics: ImpactMetric[];
  recipientResponse: string;
}

// Alternative Approaches

export interface AlternativeTag {
  label: string;
  isPositive: boolean;
}

export interface Alternative {
  label: string;
  text: string;
  impact: string;
  tags: AlternativeTag[];
}

// API Error

export interface ApiError {
  error: string;
  details?: string;
}
