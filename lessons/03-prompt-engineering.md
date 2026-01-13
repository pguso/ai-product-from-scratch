# How to Write Effective Prompts

## What is Prompt Engineering?

**Prompt engineering** is the art and science of designing inputs (prompts) that guide LLMs to produce desired outputs. It's not just "asking questions" - it's crafting instructions that account for how LLMs interpret language, handle ambiguity, and generate responses.

### Why Prompt Engineering Matters

LLMs are powerful but **unpredictable**. The same model can produce:
- **GOOD**: Perfect JSON analysis
- **BAD**: Markdown-wrapped JSON that breaks parsing
- **BAD**: Incomplete sentences (truncation)
- **BAD**: Over-interpretation (turning "send document" into relationship analysis)

**Good prompts** reduce this variability by:
1. **Explicit Instructions**: Tell the model exactly what you want
2. **Examples**: Show correct vs. incorrect output
3. **Constraints**: Limit what the model can generate
4. **Calibration**: Prevent common failure modes

## How This Project Approaches Prompt Engineering

### The Problem: Over-Interpretation

**Early versions** of this project had a critical issue: simple requests like "Can you send the document?" were being analyzed as complex relationship dynamics ("seeking validation", "testing boundaries").

**The Solution**: Calibration rules that match analysis depth to message complexity.

**File**: [`backend/lib/prompts.ts`](../backend/lib/prompts.ts) (Intent Analysis)

```typescript
CALIBRATION RULES:
1. Simple requests should have simple interpretations. 
   "Send the document" is primarily about getting a document.
2. Only infer relational dynamics when language explicitly signals them 
   (e.g., "you always", "I feel like you don't care").
3. The word "finally" indicates prior delays and mild impatience—NOT a relationship crisis.
4. Match analysis depth to message complexity. 
   A 7-word request needs a proportionate analysis.
```

**Why This Works**: Explicit rules prevent the model from "reading too much into" simple messages. The model knows to match its analysis to the complexity of the input.

### The Problem: Inconsistent Output Format

**Problem**: LLMs sometimes return:
- Markdown code blocks: `\`\`\`json { ... } \`\`\``
- Plain text explanations before JSON
- Incomplete JSON (missing fields, wrong structure)

**Solution**: Multiple layers of enforcement:

1. **Prompt Instructions**: "Respond with ONLY valid JSON. No markdown, no explanations."

**File**: [`backend/lib/prompts.ts`](../backend/lib/prompts.ts) (BASE_INSTRUCTIONS)

```typescript
const BASE_INSTRUCTIONS = `You are a communication analysis expert...

CRITICAL RULES:
1. Respond with ONLY valid JSON. No markdown, no explanations, no prefixes.
2. Base analysis STRICTLY on the provided message text. Do NOT invent context.
3. Describe what is LINGUISTICALLY SUPPORTED by the wording.
...
`;
```

2. **JSON Schema Grammar**: Enforces structure at generation time (see [`04-structured-output.md`](./04-structured-output.md))

3. **Validation**: Post-generation validation catches edge cases (see [`09-validation-error-handling.md`](./09-validation-error-handling.md))

### The Problem: Truncation

**Problem**: LLMs sometimes cut off mid-sentence, especially in longer fields:
- `"This version is making{"` (incomplete word)
- `"The recipient may feel frustrat{"` (cut off mid-word)

**Solution**: 
1. **Prompt Emphasis**: "ALL text fields MUST be COMPLETE, grammatically correct, and end with proper punctuation."

2. **Detection**: Custom truncation detection (see [`generator.ts`](../backend/lib/generator.ts))

3. **Retry with Warning**: If truncation detected, retry with enhanced prompt explaining the issue

**File**: [`backend/lib/prompts.ts`](../backend/lib/prompts.ts) (buildRetryPrompt)

```typescript
if (isTruncationError) {
  specificWarning = `
CRITICAL ERROR: Your response was TRUNCATED (cut off mid-word or mid-sentence).

YOU MUST:
1. Complete ALL text fields fully - every word, every sentence must be complete
2. Ensure all fields end with proper punctuation - NOT with incomplete characters
3. If you're running out of space, provide shorter but COMPLETE responses
...
`;
}
```

## Prompt Structure in This Project

### Base Instructions (Shared Rules)

**File**: [`backend/lib/prompts.ts`](../backend/lib/prompts.ts)

All prompts start with `BASE_INSTRUCTIONS` - common rules applied to every analysis:

```typescript
const BASE_INSTRUCTIONS = `
You are a communication analysis expert...

CRITICAL RULES:
1. Respond with ONLY valid JSON. No markdown, no explanations, no prefixes.
2. Base analysis STRICTLY on the provided message text. Do NOT invent context.
3. Describe what is LINGUISTICALLY SUPPORTED by the wording.
4. Avoid mind-reading: use "may", "can signal", "can be perceived as" when intent is not explicit.
5. Focus on observable wording patterns (phrases, structure, emphasis).
6. If context is provided, use it ONLY to understand flow, never to override the message itself.
7. ALL text fields MUST be COMPLETE, grammatically correct, and end with proper punctuation.
8. NEVER leak system language (e.g., "Response contains…", enums, parsing artifacts).
9. If uncertain, provide a restrained, context-aware interpretation rather than speculation.
`;
```

**Why Shared Base Instructions?**
- Consistency across all analysis types
- Single place to update common rules
- Reduces prompt length (DRY principle)

### Task-Specific Prompts

Each analysis type has its own prompt function:

1. **`buildIntentPrompt(message, context?)`**: Intent analysis
2. **`buildTonePrompt(message, context?)`**: Tone analysis
3. **`buildImpactPrompt(message, context?)`**: Impact prediction
4. **`buildAlternativesPrompt(message, context?)`**: Alternative generation

**Example**: Intent Analysis Prompt

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

Identify three levels of intent:
- primary: The main goal the speaker is trying to accomplish (be direct and practical)
- secondary: Any supporting goal or subtext
- implicit: A possible unstated concern (only if linguistically supported)

CALIBRATION RULES:
1. Simple requests should have simple interpretations...
2. Only infer relational dynamics when language explicitly signals them...
3. The word "finally" indicates prior delays and mild impatience—NOT a relationship crisis.
4. Match analysis depth to message complexity...
5. If no implicit intent is linguistically supported, say: "No strong implicit intent detected..."

AVOID:
- Inflating routine requests into relationship commentary
- Psychoanalyzing when a practical interpretation suffices
- Using therapy-speak for transactional messages

Respond with EXACT JSON:
{
  "primary": "Direct statement of main goal.",
  "secondary": "Supporting goal or practical subtext.",
  "implicit": "Unstated concern only if language supports it, otherwise state none detected."
}`;
}
```

**Key Elements**:
1. **Base Instructions**: Shared rules
2. **Task Description**: What to analyze
3. **Context Section**: Optional conversation history
4. **Message**: The actual text to analyze
5. **Calibration Rules**: Prevent common failures
6. **AVOID Section**: Explicit anti-patterns
7. **Output Format**: Exact JSON structure expected

## Calibration Rules: Preventing Over-Interpretation

### The "Finally" Problem

**Problem**: The word "finally" triggered dramatic interpretations:
- **WRONG**: "Relationship crisis"
- **WRONG**: "Significant relationship strain"
- **WRONG**: "Communication breakdown"

**Reality**: "Finally" usually means "I've been waiting, please send it now" - mild impatience, not a crisis.

**Solution**: Explicit calibration rule

```typescript
CALIBRATION RULES:
3. The word "finally" indicates prior delays and mild impatience—NOT a relationship crisis.
```

**Result**: Model now correctly interprets "finally" as mild impatience, not relationship breakdown.

### The Complexity Matching Problem

**Problem**: 7-word requests getting 3-paragraph analyses.

**Example**:
- Input: "Can you send the document?"
- Output: 200-word analysis about validation-seeking, boundary-testing, etc.

**Solution**: Proportional analysis rule

```typescript
CALIBRATION RULES:
4. Match analysis depth to message complexity. 
   A 7-word request needs a proportionate analysis.
```

**Result**: Short messages get concise analyses; complex messages get detailed analyses.

### The Passive-Aggressive Detection Problem

**Problem**: Single words like "finally" were flagged as passive-aggressive.

**Solution**: Require multiple markers

```typescript
PASSIVE-AGGRESSIVE DETECTION:
Only flag as passive-aggressive when MULTIPLE markers present:
- Contradiction: "It's fine" + context suggesting it's not fine
- Sarcasm markers: "Oh, great", "Thanks so much"
- Withdrawal + blame: "I'll just do it myself since..."
```

**Result**: More accurate detection (passive-aggressive is a pattern, not a single word).

## Context Handling

### How Context is Provided

**File**: [`backend/lib/session-manager.ts`](../backend/lib/session-manager.ts)

Sessions store conversation history. When analyzing a message, previous messages are formatted as context:

```typescript
formatContext(sessionId: string): string | null {
  // Returns formatted conversation history
  // Format: "Previous messages: [message1] → [message2] → [current]"
}
```

### How Context is Used in Prompts

**File**: [`backend/lib/prompts.ts`](../backend/lib/prompts.ts)

```typescript
const contextSection = context
  ? `\nCONVERSATION CONTEXT (for flow only):\n${context}\n`
  : '';
```

**Key Phrase**: "for flow only"

**Why This Matters**: Without explicit instruction, LLMs might:
- Analyze the context instead of the current message
- Over-interpret context (invent details not provided)
- Confuse context with the message itself

**The Fix**: Explicit instruction that context is "for flow only" - use it to understand conversation flow, but analyze the **current message**, not the context.

## Error-Specific Retry Prompts

### The Problem: Generic Retries Don't Work

**Bad Approach**: "Try again" - doesn't help the model understand what went wrong.

**Good Approach**: Error-specific feedback that explains exactly what failed and how to fix it.

**File**: [`backend/lib/prompts.ts`](../backend/lib/prompts.ts) (buildRetryPrompt)

```typescript
export function buildRetryPrompt(originalPrompt: string, error: string): string {
  // Analyze error to identify specific problem
  const isIntentError = error.includes('/primary') && error.includes('must NOT have fewer than 1 characters');
  const isTruncationError = error.includes('Truncated');
  const isMetricsError = error.includes('/metrics') && error.includes('must NOT have fewer than 1 items');
  
  // Build error-specific warning
  let specificWarning = '';
  if (isIntentError) {
    specificWarning = `
CRITICAL ERROR: You returned an empty string for the "primary" field...
ALL intent fields MUST:
1. Contain at least 1 character (NOT empty strings)
2. Be COMPLETE, grammatically correct sentences
3. Provide meaningful descriptions...
`;
  } else if (isTruncationError) {
    specificWarning = `
CRITICAL ERROR: Your response was TRUNCATED...
YOU MUST:
1. Complete ALL text fields fully
2. Ensure all fields end with proper punctuation
...
`;
  }
  
  return `${originalPrompt}

CRITICAL: Your previous response failed validation.
Validation Error: ${error}
${specificWarning}
...`;
}
```

**Why This Works**: 
- Model sees exactly what went wrong
- Gets specific guidance on how to fix it
- Sees examples of correct vs. incorrect output
- Most errors are fixed on the first retry

## Prompt Evolution: Learning from Failures

### Iterative Improvement

The prompts in this project **evolved through testing**. Each calibration rule was added to solve a specific problem:

1. **Over-interpretation** → Added calibration rules
2. **Inconsistent JSON** → Added "ONLY valid JSON" instruction + grammar
3. **Truncation** → Added "COMPLETE fields" instruction + detection
4. **Empty fields** → Added minLength validation + retry warnings
5. **Context confusion** → Added "for flow only" instruction

**File**: [`backend/lib/prompts.ts`](../backend/lib/prompts.ts) (top of file)

```typescript
/**
 * DESIGN DECISION: Why These Prompts?
 * 
 * These prompts evolved through iterative testing to solve specific problems:
 * 
 * 1. **Over-interpretation Problem**: Early versions would turn simple requests like
 *    "Can you send the document?" into complex relationship analyses. We added
 *    "CALIBRATION RULES" to match analysis depth to message complexity.
 * 
 * 2. **Inconsistent Output Format**: LLMs would sometimes return markdown, sometimes
 *    plain text, sometimes incomplete JSON. We use JSON schema grammars (in generator.ts)
 *    to enforce structure, but prompts must also emphasize JSON-only output.
 * ...
 */
```

**Lesson**: Good prompts aren't written once - they're **iteratively refined** based on real failures.

## Best Practices from This Project

### 1. Be Explicit, Not Implicit

**Bad**: "Analyze the message"  
**Good**: "Analyze the COMMUNICATIVE INTENT of the message below. Identify three levels: primary (main goal), secondary (supporting goal), implicit (unstated concern only if linguistically supported)."

### 2. Provide Examples

**Bad**: "Return JSON with emotions array"  
**Good**: 
```
Return ONLY this JSON structure:
{
  "emotions": [
    { "text": "Frustrated (mild)", "sentiment": "negative" }
  ]
}
```

### 3. Calibrate Against Common Failures

**Bad**: No calibration rules  
**Good**: Explicit rules like "Simple requests should have simple interpretations" and "The word 'finally' indicates mild impatience, NOT a relationship crisis."

### 4. Use Negative Instructions (AVOID)

**Bad**: Only positive instructions  
**Good**: 
```
AVOID:
- Inflating routine requests into relationship commentary
- Psychoanalyzing when a practical interpretation suffices
```

### 5. Error-Specific Feedback

**Bad**: Generic "try again"  
**Good**: "You returned an empty string for 'primary' field. ALL intent fields MUST contain at least 1 character and be complete sentences."

### 6. Separate Base Instructions from Task Instructions

**Good**: Shared `BASE_INSTRUCTIONS` + task-specific prompts. Reduces duplication, ensures consistency.

## What's Different in Production?

### 1. **Prompt Versioning**

**This Project**: Prompts in code, updated via git commits.

**Production**:
- **Prompt Registry**: Store prompts in database/config system
- **Versioning**: Track prompt versions, A/B test different prompts
- **Rollback**: Instant rollback if new prompt performs worse
- **Analytics**: Track which prompt version produced each result

### 2. **Prompt Testing Framework**

**This Project**: Manual testing, observe outputs.

**Production**:
- **Test Suite**: Automated tests with expected outputs
- **Evaluation Metrics**: Measure prompt quality (accuracy, consistency, latency)
- **Regression Testing**: Ensure prompt changes don't break existing functionality
- **A/B Testing**: Compare prompt variations on real traffic

### 3. **Dynamic Prompt Selection**

**This Project**: One prompt per analysis type.

**Production**:
- **Context-Aware Prompts**: Different prompts for different user types, languages, domains
- **Adaptive Prompts**: Adjust prompt based on message complexity, conversation history
- **Multi-Model Prompts**: Different prompts for different models (small vs. large models)

### 4. **Prompt Optimization**

**This Project**: Manual iteration based on observed failures.

**Production**:
- **Automated Optimization**: Use LLMs to improve prompts (prompt chaining, self-improvement)
- **Cost Optimization**: Shorter prompts = lower token costs
- **Latency Optimization**: Balance prompt detail vs. generation time
- **Quality Optimization**: Continuously improve based on user feedback

### 5. **Prompt Security**

**This Project**: Prompts in code, no injection concerns.

**Production**:
- **Input Sanitization**: Prevent prompt injection attacks
- **Output Filtering**: Remove sensitive information from outputs
- **Access Control**: Restrict who can modify prompts
- **Audit Logging**: Track all prompt changes

### 6. **Multi-Language Support**

**This Project**: English-only prompts.

**Production**:
- **Localized Prompts**: Different prompts for different languages
- **Language Detection**: Auto-detect message language, use appropriate prompt
- **Translation**: Translate prompts or use multilingual models

### 7. **Prompt Templates**

**This Project**: Hardcoded prompt strings.

**Production**:
- **Template System**: Parameterized prompts (e.g., `{{user_name}}`, `{{message}}`)
- **Variable Injection**: Safely inject user data, context, etc.
- **Conditional Logic**: Different prompt sections based on conditions

