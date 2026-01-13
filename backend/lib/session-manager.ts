import { ContextStore, type Session, type Interaction } from './context-store.js';
import type { AnalysisResult } from '@shared';

// =============================================================================
// Session Manager (Singleton)
// =============================================================================

let sessionManagerInstance: SessionManager | null = null;

export class SessionManager {
  private contextStore: ContextStore;

  private constructor(config?: Partial<{ maxInteractionsPerSession: number; sessionTimeoutMs: number }>) {
    this.contextStore = new ContextStore(config);
  }

  // ---------------------------------------------------------------------------
  // Singleton Pattern
  // ---------------------------------------------------------------------------

  static getInstance(config?: Partial<{ maxInteractionsPerSession: number; sessionTimeoutMs: number }>): SessionManager {
    if (!sessionManagerInstance) {
      sessionManagerInstance = new SessionManager(config);
    }
    return sessionManagerInstance;
  }

  static reset(): void {
    if (sessionManagerInstance) {
      sessionManagerInstance.dispose();
      sessionManagerInstance = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Session Operations
  // ---------------------------------------------------------------------------

  createSession(): Session {
    return this.contextStore.createSession();
  }

  getSession(sessionId: string): Session | null {
    return this.contextStore.getSession(sessionId);
  }

  deleteSession(sessionId: string): boolean {
    return this.contextStore.deleteSession(sessionId);
  }

  // ---------------------------------------------------------------------------
  // Interaction Operations
  // ---------------------------------------------------------------------------

  addInteraction(sessionId: string, message: string, analysis: AnalysisResult): boolean {
    return this.contextStore.addInteraction(sessionId, message, analysis);
  }

  getInteractions(sessionId: string): Interaction[] {
    return this.contextStore.getInteractions(sessionId);
  }

  // ---------------------------------------------------------------------------
  // Context Formatting
  // ---------------------------------------------------------------------------

  formatContext(sessionId: string): string | null {
    return this.contextStore.formatContext(sessionId);
  }

  // ---------------------------------------------------------------------------
  // Statistics
  // ---------------------------------------------------------------------------

  getStats() {
    return this.contextStore.getStats();
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  dispose(): void {
    this.contextStore.dispose();
  }
}

// =============================================================================
// Convenience Functions
// =============================================================================

export function getSessionManager(): SessionManager {
  return SessionManager.getInstance();
}
