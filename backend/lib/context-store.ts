import type { AnalysisResult } from '@shared';

// =============================================================================
// Types
// =============================================================================

export interface Interaction {
  message: string;
  analysis: AnalysisResult;
  timestamp: Date;
}

export interface Session {
  id: string;
  interactions: Interaction[];
  createdAt: Date;
  lastAccessedAt: Date;
}

// =============================================================================
// Context Store
// =============================================================================

interface ContextStoreConfig {
  maxInteractionsPerSession: number;
  sessionTimeoutMs: number;
  cleanupIntervalMs: number;
}

const DEFAULT_CONFIG: ContextStoreConfig = {
  maxInteractionsPerSession: 10, // Keep last 10 interactions
  sessionTimeoutMs: 24 * 60 * 60 * 1000, // 24 hours
  cleanupIntervalMs: 60 * 60 * 1000, // Run cleanup every hour
};

export class ContextStore {
  private sessions: Map<string, Session> = new Map();
  private config: ContextStoreConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<ContextStoreConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startCleanupJob();
  }

  // ---------------------------------------------------------------------------
  // Session Management
  // ---------------------------------------------------------------------------

  createSession(): Session {
    const id = this.generateSessionId();
    const now = new Date();
    const session: Session = {
      id,
      interactions: [],
      createdAt: now,
      lastAccessedAt: now,
    };
    this.sessions.set(id, session);
    return session;
  }

  getSession(sessionId: string): Session | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    // Update last accessed time
    session.lastAccessedAt = new Date();
    return session;
  }

  deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  // ---------------------------------------------------------------------------
  // Interaction Management
  // ---------------------------------------------------------------------------

  addInteraction(sessionId: string, message: string, analysis: AnalysisResult): boolean {
    const session = this.getSession(sessionId);
    if (!session) {
      return false;
    }

    const interaction: Interaction = {
      message,
      analysis,
      timestamp: new Date(),
    };

    session.interactions.push(interaction);

    // Keep only the last N interactions
    if (session.interactions.length > this.config.maxInteractionsPerSession) {
      session.interactions = session.interactions.slice(
        -this.config.maxInteractionsPerSession
      );
    }

    return true;
  }

  getInteractions(sessionId: string): Interaction[] {
    const session = this.getSession(sessionId);
    return session ? [...session.interactions] : [];
  }

  // ---------------------------------------------------------------------------
  // Context Formatting
  // ---------------------------------------------------------------------------

  /**
   * Format recent interactions as a context string for the LLM.
   * Designed to be concise but informative.
   */
  formatContext(sessionId: string): string | null {
    const interactions = this.getInteractions(sessionId);
    if (interactions.length === 0) {
      return null;
    }

    const contextParts: string[] = [];

    contextParts.push('Previous conversation context:');

    for (const interaction of interactions) {
      const timeAgo = this.formatTimeAgo(interaction.timestamp);
      contextParts.push(`\n[${timeAgo}] User: "${interaction.message}"`);
      contextParts.push(`Intent: ${interaction.analysis.intent.primary}`);
      contextParts.push(`Tone: ${interaction.analysis.tone.summary}`);
      
      // Include key impact metrics
      const highImpact = interaction.analysis.impact.metrics
        .filter((m: { category: string; name: string }) => m.category === 'high')
        .map((m: { category: string; name: string }) => m.name)
        .join(', ');
      if (highImpact) {
        contextParts.push(`High impact: ${highImpact}`);
      }
    }

    return contextParts.join('\n');
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  private startCleanupJob(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, this.config.cleanupIntervalMs);
  }

  private cleanupExpiredSessions(): void {
    const now = new Date();
    const expiredSessions: string[] = [];

    for (const [id, session] of this.sessions.entries()) {
      const timeSinceLastAccess = now.getTime() - session.lastAccessedAt.getTime();
      if (timeSinceLastAccess > this.config.sessionTimeoutMs) {
        expiredSessions.push(id);
      }
    }

    for (const id of expiredSessions) {
      this.sessions.delete(id);
    }

    if (expiredSessions.length > 0) {
      console.log(`Cleaned up ${expiredSessions.length} expired session(s)`);
    }
  }

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------

  private generateSessionId(): string {
    // Simple UUID v4-like generation
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  private formatTimeAgo(timestamp: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  }

  // ---------------------------------------------------------------------------
  // Statistics
  // ---------------------------------------------------------------------------

  getStats() {
    return {
      totalSessions: this.sessions.size,
      totalInteractions: Array.from(this.sessions.values()).reduce(
        (sum, session) => sum + session.interactions.length,
        0
      ),
    };
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.sessions.clear();
  }
}
