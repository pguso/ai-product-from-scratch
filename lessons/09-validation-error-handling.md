# Ensuring Quality Outputs

## The Challenge: LLMs Are Unpredictable

LLMs generate text, not structured data. Without validation, you might get:

- **Invalid JSON**: `{ "primary": "The person wants` (incomplete)
- **Empty Fields**: `{ "primary": "", "secondary": "..." }`
- **Wrong Structure**: `{ "intent": "..." }` instead of `{ "primary": "..." }`
- **Truncation**: `{ "primary": "The person is express{` (cut off mid-word)
- **Schema Violations**: `{ "sentiment": "angry" }` instead of `{ "sentiment": "negative" }`

**Solution**: Multi-layer validation + retry logic with error-specific feedback.

## Defense-in-Depth Validation Strategy

This project uses **four layers** of validation:

1. **JSON Schema Grammar** (node-llama-cpp): Enforces structure during generation
2. **Grammar Parsing**: Validates JSON structure
3. **Ajv Validation**: Validates against detailed schema (minLength, enums, etc.)
4. **Truncation Detection**: Custom validation for incomplete text

**Why Multiple Layers?**
- **Grammar** prevents most issues, but doesn't catch everything
- **Ajv** catches what grammar misses (empty strings, wrong enums)
- **Truncation Detection** catches incomplete text (grammar can't prevent)
- **Together**: Comprehensive validation pipeline

## Layer 1: JSON Schema Grammar

### How It Works

**File**: [`backend/lib/llm-service.ts`](../backend/lib/llm-service.ts)

```typescript
// Create grammar from schema
const intentGrammar = new LlamaJsonSchemaGrammar({
  llama: llama,
  schema: llamaIntentSchema,
});

// Use grammar during generation
const response = await session.prompt(prompt, {
  grammar: intentGrammar, // Enforces JSON structure
  maxTokens: 2048,
  temperature: 0.7,
});
```

**What Grammar Does**:
- **Constrains Tokens**: Only tokens that lead to valid JSON are allowed
- **Enforces Structure**: Model can't generate invalid JSON (missing braces, wrong types)
- **Guarantees Validity**: Output is always parseable JSON (though content may still be wrong)

**What Grammar Doesn't Catch**:
- Empty strings (grammar allows `""`, but schema requires `minLength: 1`)
- Wrong enum values (grammar might allow typos)
- Truncation (grammar ensures valid JSON structure, but text can be incomplete)

## Layer 2: Grammar Parsing

### Parsing with Grammar

**File**: [`backend/lib/generator.ts`](../backend/lib/generator.ts)

```typescript
// Generate with grammar
const response = await session.prompt(prompt, { grammar });

// Parse using grammar (handles JSON parsing and validation)
const parsed = grammar.parse(response) as T;
```

**What Grammar Parsing Does**:
- **Validates Structure**: Ensures JSON matches schema structure
- **Type Coercion**: Converts JSON values to correct types
- **Error Detection**: Throws error if JSON doesn't match schema

**Why Grammar Parsing?**
- **Structured Output**: Guarantees valid JSON structure
- **Early Detection**: Catches structure issues before Ajv validation
- **Type Safety**: Ensures types match schema

## Layer 3: Ajv Validation

### Schema Validation

**File**: [`backend/lib/generator.ts`](../backend/lib/generator.ts)

```typescript
// Additional validation with Ajv as safety net
if (!validator(parsed)) {
  const errors = formatValidationErrors(validator.errors);
  throw new Error(`Validation failed: ${errors}`);
}
```

**What Ajv Validates**:
- **minLength**: Ensures strings are not empty
- **Enums**: Ensures values match exact enum (e.g., `'negative'` not `'angry'`)
- **Types**: Ensures types match (string, number, boolean, etc.)
- **Required Fields**: Ensures all required fields are present
- **Additional Properties**: Rejects extra fields (if `additionalProperties: false`)

**Why Ajv?**
- **Detailed Validation**: Catches what grammar misses
- **Type Safety**: Ensures data matches TypeScript types
- **Error Messages**: Detailed error messages for debugging

### Error Formatting

**File**: [`backend/lib/validation.ts`](../backend/lib/validation.ts)

```typescript
export function formatValidationErrors(errors: any[]): string {
  return errors
    .map((error) => {
      const path = error.instancePath || 'root';
      const message = error.message || 'Validation error';
      return `${path}: ${message}`;
    })
    .join('; ');
}
```

**Example Error**:
```
/primary: must NOT have fewer than 1 characters; /emotions: must NOT have fewer than 1 items
```

**Why Formatted?**
- **Readability**: Easier to understand what failed
- **Debugging**: Clear indication of which field failed
- **Retry Prompts**: Used in error-specific retry prompts

## Layer 4: Truncation Detection

### The Problem

**Truncation**: LLMs sometimes cut off mid-sentence, especially in longer fields.

**Examples**:
- `"This version is making{"` (incomplete word)
- `"The recipient may feel frustrat{"` (cut off mid-word)
- `{ "primary": "The person is express{"` (valid JSON, but incomplete text)

**Why Grammar Doesn't Catch This**:
- Grammar ensures valid JSON structure (braces match, types correct)
- But grammar can't detect incomplete text (JSON is structurally valid)

### Truncation Detection

**File**: [`backend/lib/generator.ts`](../backend/lib/generator.ts)

```typescript
function isTruncated(text: string): boolean {
  if (!text || text.trim().length === 0) return false;

  const trimmed = text.trim();

  // Check for incomplete words (ending with special characters)
  const incompleteWordPattern = /[a-zA-Z][{[\]]$/;
  if (incompleteWordPattern.test(trimmed)) {
    return true;
  }

  // Check for incomplete JSON (unclosed brackets/braces)
  const openBraces = (trimmed.match(/{/g) || []).length;
  const closeBraces = (trimmed.match(/}/g) || []).length;
  const openBrackets = (trimmed.match(/\[/g) || []).length;
  const closeBrackets = (trimmed.match(/\]/g) || []).length;

  if (openBraces > closeBraces || openBrackets > closeBrackets) {
    if (trimmed.endsWith('{') || trimmed.endsWith('[')) {
      return true;
    }
  }

  return false;
}
```

**What This Detects**:
- **Incomplete Words**: Words ending with `{`, `[`, `]` (e.g., `"making{"`)
- **Unclosed Structures**: More opening braces than closing (e.g., `{ "primary": "text{`)
- **Incomplete Sentences**: Text ending mid-word

### Validation

**File**: [`backend/lib/generator.ts`](../backend/lib/generator.ts)

```typescript
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
```

**What This Does**:
- **Recursive Validation**: Checks all string fields in nested objects/arrays
- **Path Tracking**: Reports which field is truncated (e.g., `root.primary`)
- **Early Detection**: Catches truncation before it reaches user

## Retry Logic with Error-Specific Feedback

### The Retry Strategy

**File**: [`backend/lib/generator.ts`](../backend/lib/generator.ts)

```typescript
export async function generateWithRetry<T>(...) {
  const maxAttempts = 2;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const prompt =
        attempt === 1
          ? promptBuilder(message, context) // Original prompt
          : buildRetryPrompt(promptBuilder(message, context), lastError?.message || ''); // Enhanced prompt

      return await generateWithSchema<T>(...);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === maxAttempts) {
        throw new Error(`Failed after ${maxAttempts} attempts: ${lastError.message}`);
      }
    }
  }
}
```

**Why Only 2 Attempts?**
- **First Attempt**: Original prompt (most succeed here)
- **Second Attempt**: Enhanced prompt with error feedback (fixes most failures)
- **Why Not More**: If 2 attempts fail, issue is likely:
  - Model too small/incapable
  - Prompt needs fundamental redesign
  - Message too complex/ambiguous
  - More retries won't help, just waste time

### Error-Specific Retry Prompts

**File**: [`backend/lib/prompts.ts`](../backend/lib/prompts.ts) (buildRetryPrompt)

```typescript
export function buildRetryPrompt(originalPrompt: string, error: string): string {
  // Analyze error to identify specific problem
  const isEmptyStringError = error.includes('must NOT have fewer than 1 characters');
  const isIntentError = error.includes('/primary') && isEmptyStringError;
  const isTruncationError = error.includes('Truncated') || error.includes('truncated');
  
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
3. If you're running out of space, provide shorter but COMPLETE responses
...`;
  }
  
  return `${originalPrompt}

CRITICAL: Your previous response failed validation.
Validation Error: ${error}
${specificWarning}
...`;
}
```

**Why Error-Specific?**
- **Generic "Try Again" Doesn't Work**: Model doesn't know what went wrong
- **Error-Specific Feedback**: Model sees exactly what failed and how to fix it
- **Examples**: Shows correct vs. incorrect output
- **Most Errors Fixed on Retry**: Error-specific guidance is very effective

## Fallback Parsing

### When Grammar Parsing Fails

**File**: [`backend/lib/generator.ts`](../backend/lib/generator.ts)

```typescript
try {
  // Try grammar parsing first
  const parsed = grammar.parse(response) as T;
  // Validate with Ajv
  if (!validator(parsed)) {
    throw new Error(`Validation failed`);
  }
  return parsed;
} catch (error) {
  // If grammar parsing fails, try manual JSON parsing
  if (error instanceof Error && response) {
    try {
      const manualParsed = parseJSON<T>(response);
      if (validator(manualParsed)) {
        return manualParsed; // Accept if Ajv validates
      }
    } catch (parseError) {
      // Fall through to throw original error
    }
  }
  throw error;
}
```

**Why Fallback?**
- **Grammar Sometimes Too Strict**: Edge cases where grammar parsing fails on valid JSON
- **Manual Parsing More Lenient**: `JSON.parse()` is more forgiving
- **Still Safe**: Manual parse + Ajv validation ensures correctness
- **Trade-off**: More complex, but handles edge cases gracefully

## Post-Processing Normalization

### Impact Metrics Normalization

**File**: [`backend/lib/llm-service.ts`](../backend/lib/llm-service.ts)

```typescript
function normalizeImpactMetrics(impact: ImpactAnalysis): ImpactAnalysis {
  // Normalize categories to match value thresholds
  const normalizedMetrics = impact.metrics.map((metric) => {
    let category: 'low' | 'medium' | 'high';
    if (metric.value <= 30) {
      category = 'low';
    } else if (metric.value <= 60) {
      category = 'medium';
    } else {
      category = 'high';
    }
    return { ...metric, category };
  });

  // Enforce logical consistency
  const cooperationMetric = normalizedMetrics.find(m => m.name === 'Cooperation Likelihood');
  const frictionMetric = normalizedMetrics.find(m => m.name === 'Emotional Friction');
  
  if (cooperationMetric && frictionMetric) {
    // If cooperation is low but friction is also low, adjust for consistency
    if (cooperationMetric.value <= 30 && frictionMetric.value <= 30) {
      frictionMetric.value = 35; // Adjust to medium
      frictionMetric.category = 'medium';
    }
  }

  return { ...impact, metrics: normalizedMetrics };
}
```

**Why Post-Processing?**
- **Category Mismatches**: LLM might return `value=25` but `category="high"` (should be "low")
- **Logical Inconsistencies**: Low cooperation + low friction is unrealistic (adjust for consistency)
- **Unrealistic Scores**: Cooperation=0 for urgent requests is unrealistic (adjust to medium)

**Why Not Fix in Prompt?**
- **Prompts Already Complex**: Adding more rules makes prompts harder to maintain
- **Post-Processing Separates Concerns**: Validation logic separate from prompt logic
- **Easier to Debug**: Can log corrections, see what was fixed

## Filtering Invalid Results

### Alternatives Filtering

**File**: [`backend/lib/llm-service.ts`](../backend/lib/llm-service.ts)

```typescript
function filterValidAlternatives(alternatives: Alternative[]): Alternative[] {
  return alternatives.filter((alt) => {
    // Check text is non-empty
    if (!alt.text || alt.text.trim().length === 0) {
      console.warn(`[Alternatives] Dropping option ${alt.badge}: empty text`);
      return false;
    }

    // Check reason is non-empty
    if (!alt.reason || alt.reason.trim().length === 0) {
      return false;
    }

    // Check tags array is valid
    if (!alt.tags || alt.tags.length === 0) {
      return false;
    }

    return true;
  });
}
```

**Design Philosophy**: "Fewer valid options > broken options"

**Why Filter Instead of Retry?**
- **Retry Already Tried**: Retry logic already tried twice
- **If Still Broken**: Prompt/LLM has fundamental issue
- **Better UX**: Return 2 good alternatives than 3 where one is broken
- **Partial Results**: Better than no results

## What's Different in Production?

### 1. **More Validation Layers**

**This Project**: 4 layers (grammar, parsing, Ajv, truncation).

**Production**:
- **Content Validation**: Filter profanity, PII, sensitive data
- **Business Logic Validation**: Custom rules (e.g., "cooperation can't be 0 if friction is low")
- **Cross-Field Validation**: Validate relationships between fields
- **Output Sanitization**: Remove potentially harmful content

### 2. **Advanced Retry Strategies**

**This Project**: 2 attempts, error-specific feedback.

**Production**:
- **Exponential Backoff**: Wait longer between retries
- **Different Models**: Retry with larger model if small model fails
- **Prompt Variations**: Try different prompt variations on retry
- **Circuit Breaker**: Stop retrying if failure rate too high

### 3. **Error Tracking & Analytics**

**This Project**: Console logs, basic error messages.

**Production**:
- **Error Tracking**: Sentry, Rollbar for error monitoring
- **Error Analytics**: Track validation failure rates, common errors
- **Alerting**: Alert on high error rates
- **Error Classification**: Categorize errors (validation, truncation, network, etc.)

### 4. **Quality Metrics**

**This Project**: Binary (pass/fail validation).

**Production**:
- **Quality Scores**: Measure output quality (not just valid/invalid)
- **User Feedback**: Collect user ratings, improve based on feedback
- **A/B Testing**: Test different validation strategies
- **Continuous Improvement**: Improve prompts based on error patterns

### 5. **Graceful Degradation**

**This Project**: All-or-nothing (all analyses succeed or fail).

**Production**:
- **Partial Results**: Return what succeeded, indicate what failed
- **Fallback Responses**: Use cached/default responses if generation fails
- **Degraded Mode**: Simpler analysis if full analysis fails
- **User Choice**: Let user choose to proceed with partial results

### 6. **Validation Caching**

**This Project**: Validate every response.

**Production**:
- **Result Caching**: Cache validated results (same message = same result)
- **Validation Caching**: Cache validation results (same structure = same validation)
- **Cost Savings**: Avoid redundant validation

### 7. **Real-Time Validation**

**This Project**: Validate after generation completes.

**Production**:
- **Streaming Validation**: Validate as tokens are generated (early error detection)
- **Progressive Validation**: Validate fields as they're generated
- **Early Termination**: Stop generation if validation fails early

### 8. **Validation Testing**

**This Project**: Manual testing, observe outputs.

**Production**:
- **Test Suite**: Automated tests with expected outputs
- **Regression Testing**: Ensure validation changes don't break existing functionality
- **Edge Case Testing**: Test with edge cases (very long messages, special characters, etc.)
- **Fuzzing**: Random input testing to find validation bugs

