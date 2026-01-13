# Building REST APIs for AI Services

## The Role of APIs in AI Products

APIs are the **interface** between your AI logic and the outside world. They:

1. **Expose AI Capabilities**: Make LLM analysis accessible via HTTP
2. **Handle Requests**: Validate input, manage sessions, coordinate analysis
3. **Return Results**: Format responses, handle errors, provide status
4. **Manage State**: Sessions, context, user data

**Key Insight**: The API layer is **thin** - it orchestrates AI services, doesn't contain AI logic.

## API Structure in This Project

### Express.js Setup

**File**: [`backend/src/app.ts`](../backend/src/app.ts)

```typescript
import express from 'express';

export function createApp(
  llmService: LLMService,
  modelLoading: boolean,
  modelLoadError: Error | null,
  sessionManager: SessionManager
): express.Application {
  const app = express();

  // Middleware
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '10mb' }));

  // Routes
  app.use(createHealthRouter());
  app.use(createStatusRouter(...));
  app.use(createSessionsRouter(sessionManager));
  app.use(createLogsRouter('./logs'));
  
  // Analysis routes
  app.post('/api/analyze', ...);
  app.post('/api/analyze/intent', ...);
  app.post('/api/analyze/tone', ...);
  app.post('/api/analyze/impact', ...);
  app.post('/api/analyze/alternatives', ...);

  return app;
}
```

**Key Components**:
- **Express App**: HTTP server framework
- **Middleware**: CORS, JSON parsing, error handling
- **Routes**: Organized by feature (health, status, sessions, analysis)

## Route Organization

### Health Check Route

**File**: [`backend/src/routes/health.ts`](../backend/src/routes/health.ts)

```typescript
export function createHealthRouter() {
  const router = express.Router();
  
  router.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
  
  return router;
}
```

**Purpose**: Simple endpoint to check if server is running.

**Use Cases**:
- Load balancer health checks
- Monitoring/alerting systems
- Quick server status check

### Status Route

**File**: [`backend/src/routes/status.ts`](../backend/src/routes/status.ts)

```typescript
export function createStatusRouter(
  llmService: LLMService,
  modelLoading: boolean,
  modelLoadError: Error | null,
  sessionManager: SessionManager
) {
  const router = express.Router();
  
  router.get('/api/status', (req, res) => {
    res.json({
      model: {
        ready: llmService.initialized,
        loading: modelLoading,
        error: modelLoadError?.message || null,
      },
      sessions: sessionManager.getStats(),
    });
  });
  
  return router;
}
```

**Purpose**: Detailed status of model loading and system state.

**Why This Matters**: 
- Model loading takes time (30-60 seconds)
- Frontend needs to know when model is ready
- Users see loading state, not errors

### Analysis Route (Main Endpoint)

**File**: [`backend/src/routes/analyze.ts`](../backend/src/routes/analyze.ts)

```typescript
export function createAnalyzeHandler(
  llmService: LLMService,
  sessionManager: SessionManager
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { message, sessionId: providedSessionId } = req.body;

      // SESSION MANAGEMENT
      let sessionId = providedSessionId;
      if (!sessionId) {
        const session = sessionManager.createSession();
        sessionId = session.id;
      }

      // FORMAT CONTEXT
      const context = sessionManager.formatContext(sessionId);

      // RUN ANALYSIS
      const result = await llmService.analyzeBatched(message, context, sessionId);

      // STORE INTERACTION
      sessionManager.addInteraction(sessionId, message, result);

      // RETURN RESULT
      res.json({
        success: true,
        data: result,
        sessionId,
      });
    } catch (error) {
      next(error); // Pass to error handler
    }
  };
}
```

**Request Flow**:
1. **Validate Request** (middleware)
2. **Check Model Ready** (middleware)
3. **Get/Create Session**
4. **Format Context**
5. **Run Analysis**
6. **Store Interaction**
7. **Return Result**

## Middleware: Request Validation

### Input Validation

**File**: [`backend/src/middleware/validation.ts`](../backend/src/middleware/validation.ts)

```typescript
export function validateAnalyzeRequest(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { message } = req.body;

  // Check message exists
  if (!message) {
    return res.status(400).json({
      success: false,
      error: 'Message is required',
    });
  }

  // Check message is not empty
  if (typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Message cannot be empty',
    });
  }

  // Check message length (prevent abuse)
  if (message.length > 10000) {
    return res.status(400).json({
      success: false,
      error: 'Message too long (max 10000 characters)',
    });
  }

  next(); // Validation passed
}
```

**Why Validation Matters**:
- **Security**: Prevents abuse (extremely long messages)
- **User Experience**: Clear error messages for invalid input
- **Performance**: Reject invalid requests early (before LLM call)

### Model Readiness Check

**File**: [`backend/src/middleware/model-ready.ts`](../backend/src/middleware/model-ready.ts)

```typescript
export function requireModelReady(
  llmService: LLMService,
  modelLoading: boolean,
  modelLoadError: Error | null
) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (modelLoading) {
      return res.status(503).json({
        success: false,
        error: 'Model is still loading. Please wait.',
      });
    }

    if (modelLoadError) {
      return res.status(503).json({
        success: false,
        error: `Model failed to load: ${modelLoadError.message}`,
      });
    }

    if (!llmService.initialized) {
      return res.status(503).json({
        success: false,
        error: 'Model is not ready',
      });
    }

    next(); // Model is ready
  };
}
```

**Why This Matters**:
- **User Experience**: Clear error when model isn't ready (not generic 500 error)
- **Status Code**: 503 (Service Unavailable) is correct HTTP status
- **Prevents Errors**: Rejects requests before they hit LLM service (avoids crashes)

## Request/Response Patterns

### Request Format

**File**: [`shared/src/types.ts`](../shared/src/types.ts)

```typescript
export interface AnalyzeRequest {
  message: string;
  sessionId?: string; // Optional - backend creates if not provided
}
```

**Example Request**:
```json
{
  "message": "Can you finally send the document today?",
  "sessionId": "abc123" // Optional
}
```

### Response Format

**File**: [`shared/src/types.ts`](../shared/src/types.ts)

```typescript
export interface AnalyzeResponse {
  success: boolean;
  data?: AnalysisResult;
  sessionId: string;
  error?: string;
}
```

**Success Response**:
```json
{
  "success": true,
  "data": {
    "intent": { "primary": "...", "secondary": "...", "implicit": "..." },
    "tone": { "summary": "...", "emotions": [...], "details": "..." },
    "impact": { "metrics": [...], "recipientResponse": "..." },
    "alternatives": [...]
  },
  "sessionId": "abc123"
}
```

**Error Response**:
```json
{
  "success": false,
  "error": "Model is still loading. Please wait.",
  "sessionId": "abc123" // Still returned if session exists
}
```

### Consistent Response Structure

**Why Consistent?**
- **Frontend**: Easier to handle (always check `success` field)
- **Error Handling**: Consistent error format
- **Type Safety**: TypeScript types match response structure

## Error Handling

### Express Error Handler

**File**: [`backend/src/app.ts`](../backend/src/app.ts)

```typescript
// Error handling middleware (must be last)
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);

  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error',
  });
});
```

**What This Does**:
- Catches all unhandled errors
- Logs error (for debugging)
- Returns consistent error response
- Prevents server crashes

### Error Types

**Validation Errors** (400 Bad Request):
- Missing message
- Empty message
- Message too long

**Service Unavailable** (503):
- Model still loading
- Model failed to load
- Model not ready

**Internal Server Error** (500):
- LLM generation failed
- Unexpected errors

**Why Different Status Codes?**
- **400**: Client error (fix the request)
- **503**: Service temporarily unavailable (retry later)
- **500**: Server error (something went wrong)

## Session Management in API

### Session Creation

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

**Design Decision**: Flexible - supports both sessioned and stateless analysis.

### Context Formatting

**File**: [`backend/src/routes/analyze.ts`](../backend/src/routes/analyze.ts)

```typescript
// Format context from session history
const context = sessionManager.formatContext(sessionId);
// Returns: "Previous messages: [msg1] → [msg2]" or null if no history
```

**Why Optional Context?**
- First message has no context (analyze in isolation)
- Subsequent messages use context (conversation-aware analysis)

### Storing Interactions

**File**: [`backend/src/routes/analyze.ts`](../backend/src/routes/analyze.ts)

```typescript
// Store interaction for future context
sessionManager.addInteraction(sessionId, message, result);
```

**What This Does**:
- Stores message + analysis result in session
- Used for context in future analyses
- Enables conversation-aware analysis

## API Documentation (Swagger)

### Swagger Setup

**File**: [`backend/src/app.ts`](../backend/src/app.ts)

```typescript
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './swagger.js';

app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Communication Mirror API Documentation',
  })
);
```

**Purpose**: Interactive API documentation at `/api-docs`.

**Benefits**:
- Developers can test endpoints
- See request/response formats
- Understand API structure

### Swagger Annotations

**File**: [`backend/src/routes/analyze.ts`](../backend/src/routes/analyze.ts)

```typescript
/**
 * @swagger
 * /api/analyze:
 *   post:
 *     summary: Analyze a communication message
 *     description: Analyzes a message for intent, tone, impact, and generates alternatives.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AnalyzeRequest'
 *     responses:
 *       200:
 *         description: Analysis completed successfully
 *       400:
 *         description: Invalid request
 *       503:
 *         description: Model is not ready
 */
export function createAnalyzeHandler(...) { ... }
```

**Why Swagger?**
- **Documentation**: Auto-generated from code
- **Testing**: Interactive API testing
- **Client Generation**: Generate client SDKs from Swagger spec

## Route Organization Patterns

### Feature-Based Organization

```
backend/src/routes/
  ├── health.ts      # Health check
  ├── status.ts      # System status
  ├── analyze.ts     # Main analysis endpoint
  ├── analysis.ts    # Individual analysis endpoints
  ├── sessions.ts    # Session management
  └── logs.ts        # Log viewing
```

**Why This Structure?**
- **Separation of Concerns**: Each file handles one feature
- **Maintainability**: Easy to find and modify routes
- **Testability**: Test each route file independently

### Handler Functions

**Pattern**: Each route exports a handler function that takes dependencies.

```typescript
export function createAnalyzeHandler(
  llmService: LLMService,
  sessionManager: SessionManager
) {
  return async (req, res, next) => {
    // Handler logic
  };
}
```

**Why This Pattern?**
- **Dependency Injection**: Dependencies passed in (testable)
- **Reusability**: Same handler, different dependencies
- **Testability**: Mock dependencies in tests

## What's Different in Production?

### 1. **Authentication & Authorization**

**This Project**: No authentication.

**Production**:
- **API Keys**: Require API key in header
- **OAuth**: User authentication (login/signup)
- **JWT Tokens**: Stateless authentication
- **Role-Based Access**: Different permissions per user/role

### 2. **Rate Limiting**

**This Project**: No rate limiting.

**Production**:
- **Per-User Limits**: X requests per minute per user
- **Per-IP Limits**: Prevent abuse from single IP
- **Tiered Limits**: Free tier (10/min), paid tier (100/min)
- **Rate Limit Headers**: `X-RateLimit-Remaining`, `X-RateLimit-Reset`

### 3. **Request Validation**

**This Project**: Basic validation (message exists, not empty, length check).

**Production**:
- **Input Sanitization**: Remove XSS, SQL injection attempts
- **Schema Validation**: Use JSON Schema for request validation
- **Content Filtering**: Filter profanity, PII, sensitive data
- **Size Limits**: Stricter limits (prevent DoS)

### 4. **Error Handling**

**This Project**: Basic error handler, console logs.

**Production**:
- **Structured Logging**: JSON logs with request ID, user ID, timestamp
- **Error Tracking**: Sentry, Rollbar for error monitoring
- **Error Masking**: Don't expose internal errors to users
- **Retry Logic**: Automatic retry for transient errors

### 5. **Monitoring & Observability**

**This Project**: Console logs, basic status endpoint.

**Production**:
- **Metrics**: Request rate, latency, error rate (Prometheus, Datadog)
- **Tracing**: Distributed tracing (request flows through system)
- **Alerting**: Alert on high error rate, latency spikes
- **Dashboards**: Real-time system health dashboards

### 6. **API Versioning**

**This Project**: Single version, no versioning.

**Production**:
- **URL Versioning**: `/api/v1/analyze`, `/api/v2/analyze`
- **Header Versioning**: `Accept: application/vnd.api+json;version=2`
- **Backward Compatibility**: Support old versions while migrating
- **Deprecation**: Warn users of deprecated endpoints

### 7. **Caching**

**This Project**: No caching.

**Production**:
- **Response Caching**: Cache analysis results (same message = same result)
- **CDN Caching**: Cache static responses at edge
- **Cache Invalidation**: Invalidate when model updates
- **Cache Headers**: `Cache-Control`, `ETag` for HTTP caching

### 8. **Load Balancing**

**This Project**: Single server.

**Production**:
- **Multiple Servers**: Distribute load across servers
- **Load Balancer**: Route requests to available servers
- **Health Checks**: Remove unhealthy servers from pool
- **Session Affinity**: Route same session to same server (if needed)

### 9. **Request Queuing**

**This Project**: Direct execution, no queuing.

**Production**:
- **Request Queue**: Queue requests if servers are busy
- **Priority Queuing**: High-priority requests first
- **Timeout Handling**: Cancel requests that take too long
- **Queue Monitoring**: Track queue depth, wait times

### 10. **API Gateway**

**This Project**: Direct Express server.

**Production**:
- **API Gateway**: Central entry point (Kong, AWS API Gateway)
- **Request Routing**: Route to appropriate service
- **Authentication**: Centralized auth at gateway
- **Rate Limiting**: Gateway-level rate limiting
- **Request Transformation**: Modify requests/responses

