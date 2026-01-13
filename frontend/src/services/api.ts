import axios, { AxiosError, CancelTokenSource } from 'axios';
import type {
  AnalyzeRequest,
  IntentAnalysis,
  ToneAnalysis,
  ImpactAnalysis,
  Alternative,
  ErrorResponse,
  AnalysisResult,
} from '@shared';

/**
 * API Service Layer
 * Handles all communication with the backend API using Axios
 */

const API_BASE_URL = '/api';

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 120000, // 2 minutes timeout for LLM requests
  withCredentials: false, // Don't send credentials
});

/**
 * Extract user-friendly error message from API error
 */
function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ErrorResponse>;
    
    // Handle request cancellation
    if (axios.isCancel(error)) {
      return 'Request was cancelled';
    }
    
    // Handle NS_BINDING_ABORTED and other network errors
    // NS_BINDING_ABORTED typically appears as ERR_CANCELED or ECONNABORTED
    if (
      axiosError.code === 'ERR_CANCELED' ||
      axiosError.code === 'ECONNABORTED' ||
      axiosError.message.includes('aborted') ||
      axiosError.message.includes('canceled')
    ) {
      return 'Request was cancelled. This may happen if the backend is not running. Please ensure the backend server is running on port 3001.';
    }
    
    if (axiosError.response?.data) {
      const errorData = axiosError.response.data;
      if (errorData.success === false) {
        return errorData.error.message || 'An error occurred';
      }
    }
    
    if (axiosError.response?.status === 503) {
      return 'The AI model is still loading. Please wait a moment and try again.';
    }
    
    if (axiosError.response?.status === 400) {
      return 'Invalid request. Please check your message and try again.';
    }
    
    if (axiosError.response?.status === 404) {
      return 'Session not found. Starting a new conversation.';
    }
    
    // Network errors (no response)
    if (!axiosError.response) {
      if (
        axiosError.code === 'ERR_NETWORK' ||
        axiosError.message.includes('Network Error') ||
        axiosError.message.includes('Failed to fetch') ||
        axiosError.message.includes('ERR_CONNECTION_REFUSED')
      ) {
        return 'Unable to connect to the server. Please check that the backend is running on port 3001 and try again.';
      }
      return `Network error: ${axiosError.message || 'Please check your connection and try again.'}`;
    }
  }
  
  if (error instanceof Error) {
    // Check for NS_BINDING_ABORTED in error message
    if (error.message.includes('aborted') || error.message.includes('NS_BINDING_ABORTED')) {
      return 'Request was cancelled. Please ensure the backend server is running on port 3001.';
    }
    return error.message;
  }
  
  return 'An unexpected error occurred. Please try again.';
}

/**
 * Response types for individual endpoints
 */
interface IntentResponse {
  success: true;
  data: IntentAnalysis;
  sessionId: string;
}

interface ToneResponse {
  success: true;
  data: ToneAnalysis;
  sessionId: string;
}

interface ImpactResponse {
  success: true;
  data: ImpactAnalysis;
  sessionId: string;
}

interface AlternativesResponse {
  success: true;
  data: Alternative[];
  sessionId: string;
}

interface CreateSessionResponse {
  success: true;
  sessionId: string;
  createdAt: string;
}

/**
 * Create a new session
 */
export async function createSession(): Promise<string> {
  try {
    const response = await apiClient.post<CreateSessionResponse>('/sessions');
    if (response.data.success) {
      return response.data.sessionId;
    }
    throw new Error('Failed to create session');
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Analyze message intent
 */
export async function analyzeIntent(
  message: string,
  sessionId: string
): Promise<{ data: IntentAnalysis; sessionId: string }> {
  try {
    const request: AnalyzeRequest = { message, sessionId };
    const response = await apiClient.post<IntentResponse>('/analyze/intent', request);
    
    if (response.data.success) {
      return {
        data: response.data.data,
        sessionId: response.data.sessionId,
      };
    }
    
    throw new Error('Invalid response from server');
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Analyze message tone
 */
export async function analyzeTone(
  message: string,
  sessionId: string
): Promise<{ data: ToneAnalysis; sessionId: string }> {
  try {
    const request: AnalyzeRequest = { message, sessionId };
    const response = await apiClient.post<ToneResponse>('/analyze/tone', request);
    
    if (response.data.success) {
      return {
        data: response.data.data,
        sessionId: response.data.sessionId,
      };
    }
    
    throw new Error('Invalid response from server');
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Analyze message impact
 */
export async function analyzeImpact(
  message: string,
  sessionId: string
): Promise<{ data: ImpactAnalysis; sessionId: string }> {
  try {
    const request: AnalyzeRequest = { message, sessionId };
    const response = await apiClient.post<ImpactResponse>('/analyze/impact', request);
    
    if (response.data.success) {
      return {
        data: response.data.data,
        sessionId: response.data.sessionId,
      };
    }
    
    throw new Error('Invalid response from server');
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Generate alternative phrasings
 */
export async function generateAlternatives(
  message: string,
  sessionId: string
): Promise<{ data: Alternative[]; sessionId: string }> {
  try {
    const request: AnalyzeRequest = { message, sessionId };
    const response = await apiClient.post<AlternativesResponse>('/analyze/alternatives', request);
    
    if (response.data.success) {
      return {
        data: response.data.data,
        sessionId: response.data.sessionId,
      };
    }
    
    throw new Error('Invalid response from server');
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Analyze complete message (all analyses in parallel)
 */
export async function analyzeMessage(
  message: string,
  sessionId: string
): Promise<{ data: AnalysisResult; sessionId: string }> {
  try {
    // Call all endpoints in parallel
    const [intentResult, toneResult, impactResult, alternativesResult] = await Promise.all([
      analyzeIntent(message, sessionId),
      analyzeTone(message, sessionId),
      analyzeImpact(message, sessionId),
      generateAlternatives(message, sessionId),
    ]);

    // Use the sessionId from the first response (they should all be the same)
    const finalSessionId = intentResult.sessionId;

    const analysisResult: AnalysisResult = {
      intent: intentResult.data,
      tone: toneResult.data,
      impact: impactResult.data,
      alternatives: alternativesResult.data,
    };

    return {
      data: analysisResult,
      sessionId: finalSessionId,
    };
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Check if the API is available
 */
export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await apiClient.get('/health');
    return response.status === 200;
  } catch {
    return false;
  }
}
