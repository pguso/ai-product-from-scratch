# JSON Schemas and Grammar Constraints

## The Problem: Unstructured LLM Outputs

LLMs generate **text**, not structured data. Without constraints, you might get:

- Markdown-wrapped JSON: `\`\`\`json { ... } \`\`\``
- Incomplete JSON: `{ "primary": "The person wants"` (cut off)
- Wrong structure: `{ "intent": "..." }` instead of `{ "primary": "..." }`
- Invalid enums: `{ "sentiment": "angry" }` instead of `{ "sentiment": "negative" }`
- Missing fields: `{ "primary": "..." }` (missing `secondary` and `implicit`)

**Solution**: Enforce structure at **generation time** using JSON schema grammars, then validate with schema validators.

## Two-Layer Validation Strategy

This project uses a **defense-in-depth** approach:

1. **JSON Schema Grammar** (node-llama-cpp): Enforces structure **during generation**
2. **Ajv Validator**: Validates against TypeScript schema **after generation**

### Why Two Layers?

**Grammar** prevents most issues (invalid JSON, wrong structure), but doesn't catch:
- Empty strings (grammar allows `""`, but schema requires `minLength: 1`)
- Wrong enum values (grammar might allow typos)
- Semantic issues (truncation, incomplete sentences)

**Ajv Validator** catches what grammar misses:
- Empty strings (`minLength: 1`)
- Enum mismatches (exact enum values)
- Type mismatches (string vs. number)

**Together**: Comprehensive validation pipeline.

## JSON Schema Grammars (Generation-Time Enforcement)

### What Are JSON Schema Grammars?

**JSON Schema Grammars** are constraints that force the LLM to generate valid JSON matching a specific schema. They work by:

1. **Constraining Token Generation**: Only tokens that lead to valid JSON are allowed
2. **Enforcing Structure**: Model can't generate invalid JSON (missing braces, wrong types)
3. **Guaranteeing Validity**: Output is always parseable JSON (though content may still be wrong)

### How This Project Uses Grammars

**File**: [`backend/lib/llm-service.ts`](../backend/lib/llm-service.ts)

```typescript
import { LlamaJsonSchemaGrammar } from 'node-llama-cpp';

// Create grammar from schema
const intentGrammar = new LlamaJsonSchemaGrammar({
  llama: llama,
  schema: llamaIntentSchema, // Simplified schema object
});

// Use grammar during generation
const response = await session.prompt(prompt, {
  grammar: intentGrammar, // Enforces JSON structure
  maxTokens: 2048,
  temperature: 0.7,
});
```

**What Happens**:
1. Grammar is created from schema definition
2. During generation, model can only produce tokens that lead to valid JSON
3. Output is guaranteed to be parseable JSON matching the schema structure

### Grammar Schemas (Simplified)

**File**: [`backend/lib/schemas.ts`](../backend/lib/schemas.ts)

```typescript
// Grammar schema (simplified - for node-llama-cpp)
export const llamaIntentSchema = {
  type: 'object',
  properties: {
    primary: { type: 'string' },
    secondary: { type: 'string' },
    implicit: { type: 'string' },
  },
  required: ['primary', 'secondary', 'implicit'],
} as const;
```

**Note**: Grammar schemas are **simplified** - they don't include `minLength`, detailed enums, etc. They just enforce structure (object with these fields, types, required fields).

**Why Simplified?**: Grammars focus on structure. Detailed validation (minLength, exact enums) is handled by Ajv.

## Ajv Validation Schemas (Post-Generation Validation)

### What is Ajv?

**Ajv** (Another JSON Schema Validator) is a TypeScript/JavaScript library that validates JSON against JSON Schema definitions.

### How This Project Uses Ajv

**File**: [`backend/lib/schemas.ts`](../backend/lib/schemas.ts)

```typescript
import type { JSONSchemaType } from 'ajv';

// Ajv schema (detailed - for validation)
export const intentSchema: JSONSchemaType<IntentAnalysis> = {
  type: 'object',
  properties: {
    primary: { type: 'string', minLength: 1 }, // Must be non-empty
    secondary: { type: 'string', minLength: 1 },
    implicit: { type: 'string', minLength: 1 },
  },
  required: ['primary', 'secondary', 'implicit'],
  additionalProperties: false, // No extra fields allowed
};
```

**Key Differences from Grammar Schema**:
- `minLength: 1`: Ensures non-empty strings
- `additionalProperties: false`: Rejects extra fields
- TypeScript types: `JSONSchemaType<IntentAnalysis>` ensures type safety

### Validation Flow

**File**: [`backend/lib/generator.ts`](../backend/lib/generator.ts)

```typescript
// Generate with grammar (ensures valid JSON structure)
const response = await session.prompt(prompt, { grammar });

// Parse JSON (grammar ensures it's valid JSON)
const parsed = grammar.parse(response) as T;

// Validate with Ajv (catches grammar misses)
if (!validator(parsed)) {
  const errors = formatValidationErrors(validator.errors);
  throw new Error(`Validation failed: ${errors}`);
}
```

**What Gets Caught**:
- Empty strings: `{ "primary": "" }` → **FAILS** `minLength: 1`
- Wrong enum: `{ "sentiment": "angry" }` → **FAILS** enum `['positive', 'neutral', 'negative']`
- Extra fields: `{ "primary": "...", "extra": "..." }` → **FAILS** `additionalProperties: false`
- Missing fields: `{ "primary": "..." }` → **FAILS** `required: ['primary', 'secondary', 'implicit']`

## Schema Examples from This Project

### Intent Analysis Schema

**File**: [`backend/lib/schemas.ts`](../backend/lib/schemas.ts)

```typescript
export const intentSchema: JSONSchemaType<IntentAnalysis> = {
  type: 'object',
  properties: {
    primary: { type: 'string', minLength: 1 },
    secondary: { type: 'string', minLength: 1 },
    implicit: { type: 'string', minLength: 1 },
  },
  required: ['primary', 'secondary', 'implicit'],
  additionalProperties: false,
};
```

**What It Validates**:
- **VALID**: `{ "primary": "Request document", "secondary": "Urgency", "implicit": "None" }`
- **INVALID**: `{ "primary": "", ... }` (empty string)
- **INVALID**: `{ "primary": "..." }` (missing fields)
- **INVALID**: `{ "primary": "...", "extra": "..." }` (extra field)

### Tone Analysis Schema

**File**: [`backend/lib/schemas.ts`](../backend/lib/schemas.ts)

```typescript
export const toneSchema: JSONSchemaType<ToneAnalysis> = {
  type: 'object',
  properties: {
    summary: { type: 'string', minLength: 1 },
    emotions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string', minLength: 1 },
          sentiment: { type: 'string', enum: ['positive', 'neutral', 'negative'] },
        },
        required: ['text', 'sentiment'],
        additionalProperties: false,
      },
      minItems: 1, // At least one emotion
    },
    details: { type: 'string', minLength: 1 },
  },
  required: ['summary', 'emotions', 'details'],
  additionalProperties: false,
};
```

**What It Validates**:
- **VALID**: `{ "summary": "...", "emotions": [{ "text": "Frustrated", "sentiment": "negative" }], "details": "..." }`
- **INVALID**: `{ "emotions": [] }` (empty array - fails `minItems: 1`)
- **INVALID**: `{ "emotions": [{ "sentiment": "angry" }] }` (wrong enum value)
- **INVALID**: `{ "emotions": [{ "text": "Frustrated", "sentiment": "negative", "extra": "..." }] }` (extra field)

### Impact Analysis Schema

**File**: [`backend/lib/schemas.ts`](../backend/lib/schemas.ts)

```typescript
export const impactSchema: JSONSchemaType<ImpactAnalysis> = {
  type: 'object',
  properties: {
    metrics: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { 
            type: 'string', 
            enum: [
              'Emotional Friction',
              'Defensive Response Likelihood',
              'Relationship Strain',
              'Cooperation Likelihood'
            ]
          },
          value: { type: 'integer', minimum: 0, maximum: 100 },
          category: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
        required: ['name', 'value', 'category'],
        additionalProperties: false,
      },
      minItems: 4,
      maxItems: 4, // Exactly 4 metrics
    },
    recipientResponse: { type: 'string', minLength: 1 },
  },
  required: ['metrics', 'recipientResponse'],
  additionalProperties: false,
};
```

**What It Validates**:
- **VALID**: Exactly 4 metrics with correct names, values 0-100, categories low/medium/high
- **INVALID**: `{ "metrics": [...] }` with 3 items (fails `minItems: 4`)
- **INVALID**: `{ "name": "Friction" }` (wrong name - must be exact match)
- **INVALID**: `{ "value": 150 }` (exceeds maximum)

## How Schemas Match TypeScript Types

### Type Safety

**File**: [`shared/src/types.ts`](../shared/src/types.ts)

```typescript
export interface IntentAnalysis {
  primary: string;
  secondary: string;
  implicit: string;
}
```

**File**: [`backend/lib/schemas.ts`](../backend/lib/schemas.ts)

```typescript
export const intentSchema: JSONSchemaType<IntentAnalysis> = {
  // Schema matches TypeScript interface
  type: 'object',
  properties: {
    primary: { type: 'string', minLength: 1 },
    secondary: { type: 'string', minLength: 1 },
    implicit: { type: 'string', minLength: 1 },
  },
  required: ['primary', 'secondary', 'implicit'],
};
```

**Why This Matters**:
- **Type Safety**: TypeScript ensures schema matches interface
- **Compile-Time Checks**: Type errors if schema doesn't match type
- **Refactoring Safety**: Change interface → TypeScript forces schema update

### Shared Types

**File**: [`shared/src/types.ts`](../shared/src/types.ts)

Types are defined in `shared/` package, used by both:
- **Backend**: For validation schemas
- **Frontend**: For TypeScript types when consuming API

**Benefit**: Single source of truth. Change type once, both backend and frontend update.

## Validation Error Handling

### Formatting Validation Errors

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

**Why Formatted**: Makes it easier to understand what failed and where.

### Using Errors in Retry Prompts

**File**: [`backend/lib/prompts.ts`](../backend/lib/prompts.ts) (buildRetryPrompt)

```typescript
export function buildRetryPrompt(originalPrompt: string, error: string): string {
  // Analyze error to identify specific problem
  const isEmptyStringError = error.includes('must NOT have fewer than 1 characters');
  const isIntentError = error.includes('/primary') && isEmptyStringError;
  
  if (isIntentError) {
    specificWarning = `
CRITICAL ERROR: You returned an empty string for the "primary" field...
ALL intent fields MUST:
1. Contain at least 1 character (NOT empty strings)
2. Be COMPLETE, grammatically correct sentences
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

**Why This Works**: Error-specific feedback helps the model understand exactly what went wrong and how to fix it.

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

**Why Fallback?**: Sometimes grammar parsing is too strict (edge cases), but the JSON is actually valid. Manual parsing + Ajv validation is more lenient but still safe.

## Common Validation Issues

### Issue: Empty Strings

**Problem**: `{ "primary": "" }` - grammar allows it, but schema rejects it.

**Solution**: `minLength: 1` in schema + retry prompt warning.

### Issue: Wrong Enum Values

**Problem**: `{ "sentiment": "angry" }` - grammar might allow it, but schema requires exact enum.

**Solution**: Strict enum in schema + retry prompt with correct values.

### Issue: Truncation

**Problem**: `{ "primary": "The person is express{"` - valid JSON structure, but incomplete text.

**Solution**: Custom truncation detection (see [`generator.ts`](../backend/lib/generator.ts) `isTruncated()` function) + retry.

### Issue: Extra Fields

**Problem**: `{ "primary": "...", "extra": "..." }` - grammar might allow it, but schema rejects it.

**Solution**: `additionalProperties: false` in schema.

## What's Different in Production?

### 1. **Schema Versioning**

**This Project**: Schemas in code, updated via git commits.

**Production**:
- **Schema Registry**: Store schemas in database/config system
- **Versioning**: Track schema versions, support multiple versions simultaneously
- **Migration**: Gradual migration from old to new schema
- **Backward Compatibility**: Support old clients with old schemas

### 2. **Dynamic Schema Selection**

**This Project**: One schema per analysis type.

**Production**:
- **Context-Aware Schemas**: Different schemas for different user types, languages
- **A/B Testing**: Test different schema variations
- **Progressive Enhancement**: Start with simple schema, add fields as needed

### 3. **Schema Evolution**

**This Project**: Breaking changes require code updates.

**Production**:
- **Non-Breaking Changes**: Add optional fields, don't remove required fields
- **Deprecation**: Mark fields as deprecated, remove in future version
- **Version Negotiation**: Client and server agree on schema version

### 4. **Validation Performance**

**This Project**: Ajv validation is fast enough for single requests.

**Production**:
- **Caching**: Cache compiled validators (Ajv compiles schemas)
- **Batch Validation**: Validate multiple responses together
- **Async Validation**: Validate in background for non-critical paths

### 5. **Schema Documentation**

**This Project**: Schemas in code with TypeScript types.

**Production**:
- **OpenAPI/Swagger**: Generate API documentation from schemas
- **Schema Registry UI**: Visual schema browser
- **Client SDK Generation**: Generate client code from schemas

### 6. **Stricter Validation**

**This Project**: Basic validation (structure, types, enums).

**Production**:
- **Content Validation**: Validate text content (profanity, PII, etc.)
- **Business Logic Validation**: Custom rules (e.g., "cooperation can't be 0 if friction is low")
- **Cross-Field Validation**: Validate relationships between fields

### 7. **Error Reporting**

**This Project**: Console logs, basic error messages.

**Production**:
- **Structured Error Logs**: JSON logs with error details
- **Error Analytics**: Track validation failure rates, common errors
- **User-Friendly Errors**: Translate technical errors to user messages
- **Error Recovery**: Automatic retry with different prompts/schemas

