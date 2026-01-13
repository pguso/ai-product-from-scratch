# Managing Conversation Context

## The Problem: Stateless vs. Stateful Analysis

### Stateless Analysis (No Context)

**Example**: Analyzing "I'll just handle it myself" in isolation.

**Result**: Might interpret as:
- Direct statement
- Self-reliant attitude
- Neutral tone

**Problem**: Missing crucial context!

### Stateful Analysis (With Context)

**Example**: Same message, but with context:
```
Previous messages:
1. "Can you send the document?"
2. "I asked yesterday, still waiting"
3. "I'll just handle it myself"
```

**Result**: Now interprets as:
- Passive-aggressive withdrawal
- Frustration from ignored requests
- Relationship strain

**Key Insight**: Context **dramatically** changes interpretation.

## Why Session Management?

### The Challenge

**Problem**: Messages analyzed in isolation miss conversation context.

**Example**:
- First message: "Can you send the document?" → Direct request
- After 3 ignored requests: "I'll just handle it myself" → Passive-aggressive withdrawal

**Without Context**: Second message looks neutral.  
**With Context**: Second message shows frustration and relationship strain.

### The Solution

**Session Management** stores conversation history and provides context to LLM prompts.

**How It Works**:
1. **Create Session**: When user starts conversation
2. **Store Interactions**: Each message + analysis stored in session
3. **Format Context**: Previous messages formatted for LLM prompts
4. **Use Context**: Context included in prompts for analysis

## How This Project Implements Sessions

### Session Structure

**File**: [`backend/lib/context-store.ts`](../backend/lib/context-store.ts)

```typescript
export interface Session {
  id: string;
  createdAt: Date;
  lastActivityAt: Date;
}

export interface Interaction {
  message: string;
  analysis: AnalysisResult;
  timestamp: Date;
}
```

**What a Session Contains**:
- **ID**: Unique identifier (UUID)
- **Timestamps**: Created, last activity
- **Interactions**: Array of message + analysis pairs

### Session Manager (Singleton)

**File**: [`backend/lib/session-manager.ts`](../backend/lib/session-manager.ts)

```typescript
export class SessionManager {
  private contextStore: ContextStore;

  // Singleton pattern - one instance across app
  static getInstance(): SessionManager {
    if (!sessionManagerInstance) {
      sessionManagerInstance = new SessionManager();
    }
    return sessionManagerInstance;
  }

  createSession(): Session {
    return this.contextStore.createSession();
  }

  getSession(sessionId: string): Session | null {
    return this.contextStore.getSession(sessionId);
  }

  addInteraction(sessionId: string, message: string, analysis: AnalysisResult): boolean {
    return this.contextStore.addInteraction(sessionId, message, analysis);
  }

  formatContext(sessionId: string): string | null {
    return this.contextStore.formatContext(sessionId);
  }
}
```

**Key Design Decisions**:

1. **Singleton Pattern**: One session manager instance (shared state)
2. **In-Memory Storage**: Sessions stored in memory (fast, but lost on restart)
3. **Delegation**: SessionManager delegates to ContextStore (separation of concerns)

### Context Store (Internal Implementation)

**File**: [`backend/lib/context-store.ts`](../backend/lib/context-store.ts)

```typescript
export class ContextStore {
  private sessions: Map<string, Session> = new Map();
  private interactions: Map<string, Interaction[]> = new Map();

  createSession(): Session {
    const session: Session = {
      id: uuidv4(),
      createdAt: new Date(),
      lastActivityAt: new Date(),
    };
    this.sessions.set(session.id, session);
    this.interactions.set(session.id, []);
    return session;
  }

  addInteraction(sessionId: string, message: string, analysis: AnalysisResult): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const interaction: Interaction = {
      message,
      analysis,
      timestamp: new Date(),
    };

    const history = this.interactions.get(sessionId) || [];
    history.push(interaction);
    this.interactions.set(sessionId, history);

    session.lastActivityAt = new Date();
    return true;
  }

  formatContext(sessionId: string): string | null {
    const history = this.interactions.get(sessionId);
    if (!history || history.length === 0) return null;

    // Format as conversation history
    return history
      .map(i => i.message)
      .join(' → ');
  }
}
```

**What This Does**:
- **Storage**: In-memory Maps (fast, simple)
- **Context Formatting**: Formats interactions as conversation history
- **Session Management**: Creates, retrieves, updates sessions

## Context Formatting

### Simple Format

**Current Implementation**:
```typescript
formatContext(sessionId: string): string | null {
  const history = this.interactions.get(sessionId);
  if (!history || history.length === 0) return null;

  return history
    .map(i => i.message)
    .join(' → ');
}
```

**Output Example**:
```
"Can you send the document? → I asked yesterday, still waiting → I'll just handle it myself"
```

**Why This Format?**
- **Simple**: Easy to parse, understand
- **Concise**: Doesn't waste tokens
- **Clear**: Shows conversation flow

### Context in Prompts

**File**: [`backend/lib/prompts.ts`](../backend/lib/prompts.ts)

```typescript
export function buildIntentPrompt(message: string, context?: string): string {
  const contextSection = context
    ? `\nCONVERSATION CONTEXT (for flow only):\n${context}\n`
    : '';

  return `${BASE_INSTRUCTIONS}

TASK
Analyze the COMMUNICATIVE INTENT of the message below.

${contextSection}

MESSAGE:
"${message}"

...`;
}
```

**Key Phrase**: "for flow only"

**Why This Matters**: Without explicit instruction, LLMs might:
- Analyze the context instead of the current message
- Over-interpret context (invent details not provided)
- Confuse context with the message itself

**The Fix**: Explicit instruction that context is "for flow only" - use it to understand conversation flow, but analyze the **current message**, not the context.

## Session Lifecycle

### Creation

**File**: [`backend/src/routes/analyze.ts`](../backend/src/routes/analyze.ts)

```typescript
// If sessionId provided, use it
let sessionId = providedSessionId;

// If no sessionId, create new session
if (!sessionId) {
  const session = sessionManager.createSession();
  sessionId = session.id;
  console.log(`[Analyze] Created new session: ${sessionId}`);
}
```

**When Sessions Are Created**:
- **First Request**: No sessionId provided → create new
- **Frontend Init**: Frontend creates session on page load
- **Session Invalid**: Old session not found → create new

### Adding Interactions

**File**: [`backend/src/routes/analyze.ts`](../backend/src/routes/analyze.ts)

```typescript
// Run analysis
const result = await llmService.analyzeBatched(message, context, sessionId);

// Store interaction for future context
sessionManager.addInteraction(sessionId, message, result);
```

**What Gets Stored**:
- **Message**: The original message text
- **Analysis**: Complete analysis result (intent, tone, impact, alternatives)
- **Timestamp**: When the interaction occurred

**Why Store Analysis?**
- **Future Use**: Might use analysis results in context (not just messages)
- **Debugging**: Can review past analyses
- **Analytics**: Track analysis patterns over time

### Context Retrieval

**File**: [`backend/src/routes/analyze.ts`](../backend/src/routes/analyze.ts)

```typescript
// Format context from session history
const context = sessionManager.formatContext(sessionId);

// Pass context to analysis (or null if no history)
const result = await llmService.analyzeBatched(message, context || undefined, sessionId);
```

**When Context is Used**:
- **First Message**: No context (analyze in isolation)
- **Subsequent Messages**: Context included (conversation-aware analysis)

**Why Optional?**
- **Flexibility**: Can analyze with or without context
- **First Message**: No context available
- **Stateless Mode**: Can disable context if needed

## Frontend Session Management

### Session Initialization

**File**: [`frontend/src/components/EditorView.tsx`](../frontend/src/components/EditorView.tsx)

```typescript
const SESSION_STORAGE_KEY = 'communication-mirror-session-id';

useEffect(() => {
  const initializeSession = async () => {
    // Try to load existing session from localStorage
    const stored = localStorage.getItem(SESSION_STORAGE_KEY);
    
    if (stored) {
      setSessionId(stored);
    } else {
      // Create new session
      const newSessionId = await createSession();
      setSessionId(newSessionId);
      localStorage.setItem(SESSION_STORAGE_KEY, newSessionId);
    }
  };

  initializeSession();
}, []);
```

**What This Does**:
1. **Check localStorage**: See if session exists from previous visit
2. **Create if Missing**: Create new session if none exists
3. **Persist**: Store session ID in localStorage

**Why localStorage?**
- **Persistence**: Session survives page refresh
- **User Experience**: Conversation continues across page reloads
- **Simplicity**: No backend session management needed (backend handles it)

### Session Updates

**File**: [`frontend/src/components/EditorView.tsx`](../frontend/src/components/EditorView.tsx)

```typescript
const handleAnalyze = async (messageToAnalyze: string) => {
  try {
    const response = await analyzeMessage(messageToAnalyze, sessionId);
    setAnalysis(response.data);
    
    // Update sessionId (backend may create new one if none provided)
    if (response.sessionId) {
      setSessionId(response.sessionId);
      localStorage.setItem(SESSION_STORAGE_KEY, response.sessionId);
    }
  } catch (err) {
    // Handle error, maybe create new session
    if (err.message.includes('Session not found')) {
      const newSessionId = await createSession();
      setSessionId(newSessionId);
      localStorage.setItem(SESSION_STORAGE_KEY, newSessionId);
    }
  }
};
```

**Why Update Session ID?**
- **Backend Creates**: Backend may create new session if provided one is invalid
- **Sync State**: Keep frontend session ID in sync with backend
- **Error Recovery**: Create new session if old one fails

## Session Limitations

### In-Memory Storage

**Current Implementation**: Sessions stored in memory (Map data structure).

**Limitations**:
- **Lost on Restart**: Sessions disappear when server restarts
- **No Persistence**: No database, no file storage
- **Single Server**: Can't share sessions across multiple servers

**Why This Design?**
- **Simplicity**: No database setup needed
- **Learning Focus**: Understand session logic without persistence complexity
- **Trade-off**: Acceptable for educational project

### Context Length Limits

**Problem**: Context can grow indefinitely (every message adds to context).

**Current Implementation**: No limits (context grows with conversation).

**Potential Issues**:
- **Token Limits**: LLM context windows (4096 tokens) limit how much context can be included
- **Performance**: Longer context = slower analysis
- **Cost**: More tokens = higher costs (if using API)

**Solutions** (not implemented, but would be in production):
- **Limit History**: Only include last N messages
- **Summarization**: Summarize old messages instead of including full text
- **Sliding Window**: Keep recent messages, summarize older ones

## Session Statistics

### Stats Endpoint

**File**: [`backend/src/routes/status.ts`](../backend/src/routes/status.ts)

```typescript
router.get('/api/status', (req, res) => {
  res.json({
    model: { ... },
    sessions: sessionManager.getStats(),
  });
});
```

**File**: [`backend/lib/session-manager.ts`](../backend/lib/session-manager.ts)

```typescript
getStats() {
  return this.contextStore.getStats();
}
```

**File**: [`backend/lib/context-store.ts`](../backend/lib/context-store.ts)

```typescript
getStats() {
  return {
    totalSessions: this.sessions.size,
    totalInteractions: Array.from(this.interactions.values())
      .reduce((sum, interactions) => sum + interactions.length, 0),
  };
}
```

**What Stats Show**:
- **Total Sessions**: Number of active sessions
- **Total Interactions**: Total messages analyzed across all sessions

**Why Stats?**
- **Monitoring**: Track system usage
- **Debugging**: Understand session patterns
- **Analytics**: Measure user engagement

## What's Different in Production?

### 1. **Persistent Storage**

**This Project**: In-memory storage (lost on restart).

**Production**:
- **Database**: Store sessions in PostgreSQL, MongoDB, Redis
- **Persistence**: Sessions survive server restarts
- **Backup**: Regular backups of session data
- **Recovery**: Restore sessions from backups

### 2. **Session Expiration**

**This Project**: Sessions never expire (grow indefinitely).

**Production**:
- **TTL (Time To Live)**: Sessions expire after inactivity (e.g., 30 days)
- **Cleanup Jobs**: Periodic jobs to delete expired sessions
- **Storage Management**: Prevent unbounded growth

### 3. **Session Sharing**

**This Project**: Single server, in-memory (no sharing needed).

**Production**:
- **Shared Storage**: Redis, database (multiple servers share sessions)
- **Session Affinity**: Route same session to same server (if needed)
- **Distributed Sessions**: Sessions work across load-balanced servers

### 4. **Context Management**

**This Project**: Unlimited context (all messages included).

**Production**:
- **Context Limits**: Only include last N messages (e.g., last 10)
- **Summarization**: Summarize old messages instead of full text
- **Token Budget**: Allocate tokens between context and response
- **Smart Truncation**: Keep most relevant messages, drop least relevant

### 5. **Session Security**

**This Project**: No security (anyone can access any session with ID).

**Production**:
- **Authentication**: Users can only access their own sessions
- **Authorization**: Check user owns session before access
- **Session IDs**: Use cryptographically secure IDs (prevent guessing)
- **Rate Limiting**: Limit session creation per user/IP

### 6. **Session Analytics**

**This Project**: Basic stats (total sessions, interactions).

**Production**:
- **User Analytics**: Track sessions per user, average session length
- **Engagement Metrics**: Messages per session, session duration
- **Retention**: Track returning users, session frequency
- **A/B Testing**: Test different session management strategies

### 7. **Session Migration**

**This Project**: No migration (sessions lost on restart).

**Production**:
- **Data Migration**: Migrate sessions when schema changes
- **Versioning**: Support multiple session formats simultaneously
- **Backward Compatibility**: Handle old session formats

### 8. **Multi-User Sessions**

**This Project**: One session per user (implicit).

**Production**:
- **Explicit Users**: Associate sessions with user accounts
- **Shared Sessions**: Multiple users in same session (collaboration)
- **Session Permissions**: Who can read/write to session
- **Session Sharing**: Share session links with others

### 9. **Session Search**

**This Project**: No search (can't find old sessions).

**Production**:
- **Search**: Search sessions by message content, date, user
- **Filters**: Filter sessions by criteria
- **Export**: Export session data (CSV, JSON)
- **Archival**: Archive old sessions, keep searchable

### 10. **Session Replay**

**This Project**: No replay (can't review past sessions).

**Production**:
- **Session History**: View all messages in session
- **Analysis History**: See past analyses for each message
- **Timeline**: Visual timeline of conversation
- **Export**: Export session as transcript

