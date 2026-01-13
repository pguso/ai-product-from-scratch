# Breaking Complex Tasks into Steps

## The Challenge: Complex Analysis Requires Multiple Steps

Analyzing communication is **complex**. A single message needs:

1. **Intent Analysis**: What is the speaker trying to accomplish?
2. **Tone Analysis**: What emotions does this convey?
3. **Impact Analysis**: How will the recipient likely respond?
4. **Alternatives Generation**: What are better ways to phrase this?

Each step requires different reasoning:
- **Intent**: Understanding goals and subtext
- **Tone**: Detecting emotional signals
- **Impact**: Predicting human behavior
- **Alternatives**: Creative rewriting

**Question**: How do we coordinate these steps efficiently?

## Two Approaches: Sequential vs. Parallel

### Sequential Approach (Slow)

```typescript
// Run analyses one after another
const intent = await analyzeIntent(message);
const tone = await analyzeTone(message);
const impact = await analyzeImpact(message);
const alternatives = await generateAlternatives(message);

// Total time: intent_time + tone_time + impact_time + alternatives_time
// Example: 3s + 3s + 3s + 3s = 12 seconds
```

**Problem**: Slow. Each analysis waits for the previous one to finish.

### Parallel Approach (Fast)

```typescript
// Run all analyses simultaneously
const [intent, tone, impact, alternatives] = await Promise.all([
  analyzeIntent(message),
  analyzeTone(message),
  analyzeImpact(message),
  generateAlternatives(message),
]);

// Total time: max(intent_time, tone_time, impact_time, alternatives_time)
// Example: max(3s, 3s, 3s, 3s) = 3 seconds (4x faster!)
```

**Benefit**: Much faster. All analyses run concurrently.

**Trade-off**: Uses more memory (4 model contexts in parallel), but worth it for speed.

## How This Project Implements Parallel Analysis

### Batched Analysis Function

**File**: [`backend/lib/llm-service.ts`](../backend/lib/llm-service.ts)

```typescript
async analyzeBatched(
  message: string,
  context?: string,
  sessionId?: string
): Promise<AnalysisResult> {
  // Run all 4 analyses in parallel
  const [intent, tone, impact, alternatives] = await Promise.all([
    this.analyzeIntent(message, context, sessionId),
    this.analyzeTone(message, context, sessionId),
    this.analyzeImpact(message, context, sessionId),
    this.analyzeAlternatives(message, context, sessionId),
  ]);

  return {
    intent,
    tone,
    impact,
    alternatives,
  };
}
```

**What Happens**:
1. `Promise.all()` starts all 4 analyses simultaneously
2. Each analysis runs in parallel (different model contexts)
3. Function returns when **all** analyses complete
4. Total time = time of slowest analysis (not sum of all)

### Individual Analysis Functions

Each analysis type has its own function:

**File**: [`backend/lib/llm-service.ts`](../backend/lib/llm-service.ts)

```typescript
async analyzeIntent(
  message: string,
  context?: string,
  sessionId?: string
): Promise<IntentAnalysis> {
  const prompt = buildIntentPrompt(message, context);
  return await generateWithRetry(
    buildIntentPrompt,
    this.intentGrammar,
    this.intentValidator,
    message,
    { contextSequence: this.contextSequence, ... },
    buildRetryPrompt,
    context,
    {},
    'intent'
  );
}
```

**Key Points**:
- Each function uses the **same model instance** (shared `contextSequence`)
- Each function has its own **prompt builder** (`buildIntentPrompt`, `buildTonePrompt`, etc.)
- Each function has its own **grammar** and **validator**
- All run concurrently via `Promise.all()`

## Why This Works: Shared Model, Separate Contexts

### Model Sharing

**File**: [`backend/lib/llm-service.ts`](../backend/lib/llm-service.ts)

```typescript
class LLMService {
  private model: LlamaModel;
  private contextSequence: LlamaContextSequence;

  async initialize() {
    this.model = new LlamaModel({ modelPath: config.modelPath });
    this.contextSequence = new LlamaContextSequence({
      model: this.model,
      contextSize: 4096,
    });
  }
}
```

**Key Insight**: One model instance, shared across all analyses.

**Why This Works**: 
- Model stays in memory (loaded once at startup)
- Each analysis creates its own **chat session** (isolated context)
- Multiple sessions can use the same model concurrently

### Session Isolation

**File**: [`backend/lib/generator.ts`](../backend/lib/generator.ts)

```typescript
export async function generateWithSchema<T>(...) {
  // Create a new session for this generation
  const session = new LlamaChatSession({
    contextSequence, // Shared context sequence
    systemPrompt,     // Session-specific system prompt
  });

  // Generate with this session
  const response = await session.prompt(prompt, { grammar, ... });
}
```

**What This Means**:
- Each analysis gets its own `LlamaChatSession`
- Sessions are isolated (one analysis doesn't affect another)
- All sessions share the same underlying model (efficient)

## API Design: Single Endpoint for Full Analysis

### The Design Decision

**File**: [`backend/src/routes/analyze.ts`](../backend/src/routes/analyze.ts)

```typescript
/**
 * API DESIGN DECISIONS:
 * 
 * 1. **Single Endpoint for Full Analysis**
 *    - Why: Frontend typically needs all analyses (intent, tone, impact, alternatives)
 *    - Benefit: One request instead of four, faster overall (batching)
 *    - Alternative: Separate endpoints - available but full analysis is common case
 */
export function createAnalyzeHandler(llmService, sessionManager) {
  return async (req, res) => {
    const { message, sessionId } = req.body;
    
    // Get or create session, format context
    const context = sessionManager.formatContext(sessionId);
    
    // Run batched analysis (all 4 analyses in parallel)
    const result = await llmService.analyzeBatched(message, context, sessionId);
    
    // Store interaction in session
    sessionManager.addInteraction(sessionId, message, result);
    
    res.json({ success: true, data: result, sessionId });
  };
}
```

**Why Single Endpoint?**
- **Common Case**: Frontend usually needs all analyses
- **Efficiency**: One request, parallel execution, faster overall
- **Simplicity**: Frontend doesn't need to coordinate 4 separate requests

### Individual Endpoints (Also Available)

**File**: [`backend/src/app.ts`](../backend/src/app.ts)

```typescript
// Full analysis (all 4 in parallel)
app.post('/api/analyze', ...);

// Individual analyses (can be called separately)
app.post('/api/analyze/intent', ...);
app.post('/api/analyze/tone', ...);
app.post('/api/analyze/impact', ...);
app.post('/api/analyze/alternatives', ...);
```

**Why Both?**
- **Full Analysis**: Common case, optimized for speed
- **Individual**: Flexibility (maybe frontend only needs tone analysis)

## Context Sharing Across Analyses

### How Context is Used

**File**: [`backend/src/routes/analyze.ts`](../backend/src/routes/analyze.ts)

```typescript
// Get conversation context from session
const context = sessionManager.formatContext(sessionId);

// Pass same context to all analyses
const result = await llmService.analyzeBatched(message, context, sessionId);
```

**What Context Contains**:
- Previous messages in the conversation
- Formatted as: "Previous messages: [message1] → [message2] → [current]"

**Why Same Context?**
- All analyses should see the same conversation history
- Consistency: Intent, tone, impact all based on same context
- Efficiency: Format context once, reuse for all analyses

### Context Formatting

**File**: [`backend/lib/session-manager.ts`](../backend/lib/session-manager.ts)

```typescript
formatContext(sessionId: string): string | null {
  const interactions = this.getInteractions(sessionId);
  if (interactions.length === 0) return null;
  
  // Format as conversation history
  return interactions
    .map(i => i.message)
    .join(' → ');
}
```

**Key Points**:
- Context is **optional** (first message has no context)
- Context is **formatted once** and reused for all analyses
- Context is **explicitly marked** in prompts as "for flow only" (see [`prompts.ts`](../backend/lib/prompts.ts))

## Error Handling in Parallel Execution

### What Happens if One Analysis Fails?

**File**: [`backend/lib/llm-service.ts`](../backend/lib/llm-service.ts)

```typescript
async analyzeBatched(...): Promise<AnalysisResult> {
  try {
    const [intent, tone, impact, alternatives] = await Promise.all([...]);
    return { intent, tone, impact, alternatives };
  } catch (error) {
    // If any analysis fails, entire batch fails
    throw error;
  }
}
```

**Current Behavior**: If **any** analysis fails, the entire batch fails.

**Why This Design?**
- **Simplicity**: Easier to handle (one error, not partial results)
- **Consistency**: Frontend gets complete result or error, not partial data
- **Trade-off**: One failure fails everything (could be improved with partial results)

### Retry Logic Per Analysis

**File**: [`backend/lib/generator.ts`](../backend/lib/generator.ts)

```typescript
export async function generateWithRetry<T>(...) {
  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await generateWithSchema<T>(...);
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      // Retry with enhanced prompt (error-specific feedback)
    }
  }
}
```

**What This Means**:
- Each analysis has its own retry logic (2 attempts)
- If first attempt fails, retry with error-specific prompt
- If second attempt fails, that analysis fails → entire batch fails

## Performance Considerations

### Memory Usage

**Parallel Execution Uses More Memory**:
- 4 model contexts in parallel (vs. 1 sequential)
- Each context uses RAM (depends on context size)
- **Trade-off**: More memory for faster execution

**Mitigation**:
- Context size is limited (4096 tokens)
- Sessions are short-lived (created per request, destroyed after)
- Model is shared (not duplicated)

### Latency

**Sequential**: `3s + 3s + 3s + 3s = 12s`  
**Parallel**: `max(3s, 3s, 3s, 3s) = 3s` (4x faster)

**Real-World**: Parallel execution is **much faster** for multi-step analysis.

### CPU/GPU Utilization

**Sequential**: Model is idle between analyses (wasted resources)  
**Parallel**: Model is utilized efficiently (all analyses run concurrently)

**Benefit**: Better hardware utilization, faster overall.

## When to Use Sequential vs. Parallel

### Use Parallel When:
- Analyses are **independent** (don't depend on each other)
- You need **all results** (not just one)
- **Speed matters** (user waiting for response)
- You have **sufficient resources** (RAM, CPU/GPU)

### Use Sequential When:
- Analyses **depend on each other** (output of step 1 feeds into step 2)
- You only need **one result** (skip others if first fails)
- **Resources are limited** (can't run multiple in parallel)
- **Cost matters** (parallel uses more resources)

### This Project's Choice

**Parallel** because:
- Analyses are independent (intent doesn't need tone, etc.)
- Frontend needs all results
- Speed matters (user experience)
- Local LLM can handle parallel execution

## What's Different in Production?

### 1. **Request Queuing**

**This Project**: Direct execution, no queuing.

**Production**:
- **Request Queue**: Queue requests if model is busy
- **Priority Queuing**: High-priority requests first
- **Rate Limiting**: Limit requests per user/IP
- **Timeout Handling**: Cancel requests that take too long

### 2. **Partial Results**

**This Project**: All-or-nothing (all analyses succeed or fail together).

**Production**:
- **Partial Results**: Return what succeeded, indicate what failed
- **Graceful Degradation**: Show intent + tone even if alternatives failed
- **Retry Failed Steps**: Retry only failed analyses, not entire batch

### 3. **Caching**

**This Project**: No caching (every request runs full analysis).

**Production**:
- **Result Caching**: Cache analysis results (same message = same result)
- **Context-Aware Caching**: Cache with context key
- **Cache Invalidation**: Invalidate when context changes
- **Cost Savings**: Avoid redundant LLM calls

### 4. **Streaming Results**

**This Project**: Wait for all analyses, return complete result.

**Production**:
- **Streaming**: Return results as they complete (intent first, then tone, etc.)
- **Progressive UI**: Show partial results, update as more complete
- **Better UX**: User sees results faster (doesn't wait for slowest analysis)

### 5. **Load Balancing**

**This Project**: Single server, single model.

**Production**:
- **Multiple Model Servers**: Distribute analyses across servers
- **Load Balancing**: Route requests to available servers
- **Auto-Scaling**: Scale up during high traffic, scale down during low traffic

### 6. **Analysis Prioritization**

**This Project**: All analyses equal priority.

**Production**:
- **Priority Levels**: Critical analyses (intent) before optional (alternatives)
- **User Tiers**: Premium users get faster analysis
- **Feature Flags**: Enable/disable analyses per user/plan

### 7. **Dependency Management**

**This Project**: All analyses independent.

**Production**:
- **Dependencies**: Some analyses might depend on others
  - Example: Alternatives generation might use intent + tone results
- **Dependency Graph**: Define analysis dependencies
- **Optimization**: Skip analyses if dependencies fail

