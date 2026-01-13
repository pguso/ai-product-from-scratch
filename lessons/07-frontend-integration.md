# Connecting UI to AI Backend

## The Frontend's Role

The frontend is the **user interface** that:
1. **Collects Input**: User types message to analyze
2. **Calls API**: Sends request to backend
3. **Displays Results**: Shows analysis (intent, tone, impact, alternatives)
4. **Manages State**: Handles loading, errors, sessions

**Key Insight**: The frontend is **thin** - it orchestrates API calls and displays data, doesn't contain AI logic.

## Frontend Architecture

### React + TypeScript

**File**: [`frontend/src/components/EditorView.tsx`](../frontend/src/components/EditorView.tsx)

```typescript
import { useState, useEffect } from 'react';
import { analyzeMessage, createSession } from '../services/api';

function EditorView() {
  const [message, setMessage] = useState('Can you finally send the document today?');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const handleAnalyze = async (messageToAnalyze: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await analyzeMessage(messageToAnalyze, sessionId);
      setAnalysis(response.data);
      setSessionId(response.sessionId);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <EditorPanel
        message={message}
        onMessageChange={setMessage}
        onAnalyze={handleAnalyze}
        isLoading={isLoading}
      />
      <AnalysisPanel analysis={analysis} isLoading={isLoading} />
      {error && <ErrorToast error={error} />}
    </div>
  );
}
```

**Key Components**:
- **State Management**: React hooks (`useState`, `useEffect`)
- **API Service**: Separate service layer (`services/api.ts`)
- **Components**: Separated into `EditorPanel` and `AnalysisPanel`
- **Error Handling**: Error state, error display

## API Service Layer

### Why a Service Layer?

**Separation of Concerns**: 
- **Components**: UI logic (state, rendering)
- **Service Layer**: API communication (HTTP requests, error handling)

**Benefits**:
- **Reusability**: Same API calls from multiple components
- **Testability**: Mock API service in tests
- **Maintainability**: Change API without touching components

### API Service Implementation

**File**: [`frontend/src/services/api.ts`](../frontend/src/services/api.ts)

```typescript
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export async function analyzeMessage(
  message: string,
  sessionId?: string
): Promise<{ data: AnalysisResult; sessionId: string }> {
  try {
    const request: AnalyzeRequest = { message, sessionId };
    const response = await apiClient.post<AnalyzeResponse>('/api/analyze', request);
    
    if (response.data.success) {
      return {
        data: response.data.data!,
        sessionId: response.data.sessionId,
      };
    }
    
    throw new Error('Invalid response from server');
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}
```

**Key Features**:
- **Axios Client**: HTTP client with base URL configuration
- **Type Safety**: TypeScript types for requests/responses
- **Error Handling**: Converts errors to user-friendly messages
- **Environment Variables**: Configurable API URL

### Error Handling

**File**: [`frontend/src/services/api.ts`](../frontend/src/services/api.ts)

```typescript
function getErrorMessage(error: any): string {
  if (axios.isAxiosError(error)) {
    if (error.response) {
      // Server responded with error
      return error.response.data.error || 'Server error';
    } else if (error.request) {
      // Request made but no response
      return 'No response from server. Is the backend running?';
    }
  }
  return error.message || 'Unknown error';
}
```

**Why This Matters**:
- **User-Friendly**: Clear error messages (not technical details)
- **Network Errors**: Handles offline, timeout, connection errors
- **Server Errors**: Displays backend error messages

## Component Organization

### Editor Panel (Input)

**File**: [`frontend/src/components/EditorPanel.tsx`](../frontend/src/components/EditorPanel.tsx)

```typescript
interface EditorPanelProps {
  message: string;
  onMessageChange: (message: string) => void;
  onAnalyze: (message: string) => void;
  isLoading: boolean;
}

export function EditorPanel({ message, onMessageChange, onAnalyze, isLoading }: EditorPanelProps) {
  return (
    <div className="editor-panel">
      <textarea
        value={message}
        onChange={(e) => onMessageChange(e.target.value)}
        placeholder="Type your message here..."
        disabled={isLoading}
      />
      <button
        onClick={() => onAnalyze(message)}
        disabled={isLoading || !message.trim()}
      >
        {isLoading ? 'Analyzing...' : 'Analyze'}
      </button>
    </div>
  );
}
```

**Responsibilities**:
- **Input Collection**: Textarea for message input
- **User Actions**: Analyze button
- **Loading State**: Disable input during analysis
- **Validation**: Disable button if message is empty

### Analysis Panel (Output)

**File**: [`frontend/src/components/AnalysisPanel.tsx`](../frontend/src/components/AnalysisPanel.tsx)

```typescript
interface AnalysisPanelProps {
  analysis: AnalysisResult | null;
  isLoading: boolean;
}

export function AnalysisPanel({ analysis, isLoading }: AnalysisPanelProps) {
  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!analysis) {
    return <EmptyState />;
  }

  return (
    <div className="analysis-panel">
      <IntentAnalysis intent={analysis.intent} />
      <ToneAnalysis tone={analysis.tone} />
      <ImpactAnalysis impact={analysis.impact} />
      <Alternatives alternatives={analysis.alternatives} />
    </div>
  );
}
```

**Responsibilities**:
- **Conditional Rendering**: Show loading, empty state, or results
- **Component Composition**: Separate components for each analysis type
- **Data Display**: Format and display analysis results

### Sub-Components

Each analysis type has its own component:

- **`IntentAnalysis.tsx`**: Displays primary, secondary, implicit intent
- **`ToneAnalysis.tsx`**: Displays summary, emotions, details
- **`ImpactAnalysis.tsx`**: Displays metrics, recipient response
- **`Alternatives.tsx`**: Displays alternative phrasings

**Why Separate Components?**
- **Modularity**: Each component handles one analysis type
- **Reusability**: Use components elsewhere
- **Maintainability**: Update one component without affecting others

## Session Management

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
    }
  } catch (err) {
    // Handle error, maybe create new session
    if (err.message.includes('Session not found')) {
      const newSessionId = await createSession();
      setSessionId(newSessionId);
    }
  }
};
```

**Why Update Session ID?**
- **Backend Creates**: Backend may create new session if provided one is invalid
- **Sync State**: Keep frontend session ID in sync with backend
- **Error Recovery**: Create new session if old one fails

## Loading States

### Loading Indicators

**File**: [`frontend/src/components/EditorView.tsx`](../frontend/src/components/EditorView.tsx)

```typescript
{isLoading && (
  <div className="loading-spinner">
    <Spinner />
    <p>Analyzing message...</p>
  </div>
)}
```

**Why Loading States?**
- **User Feedback**: User knows something is happening
- **Prevent Double-Clicks**: Disable button during loading
- **Better UX**: Clear indication of progress

### Model Loading State

**File**: [`frontend/src/components/EditorView.tsx`](../frontend/src/components/EditorView.tsx)

```typescript
const [modelReady, setModelReady] = useState(false);

useEffect(() => {
  const checkModelStatus = async () => {
    const status = await checkApiStatus();
    setModelReady(status.model.ready);
    
    if (!status.model.ready && !status.model.loading) {
      // Model failed to load
      setError('Model failed to load. Please refresh the page.');
    }
  };

  const interval = setInterval(checkModelStatus, 2000); // Check every 2 seconds
  return () => clearInterval(interval);
}, []);
```

**What This Does**:
- **Poll Status**: Check model status every 2 seconds
- **Show Loading**: Display loading state while model loads
- **Handle Errors**: Show error if model fails to load

**Why Polling?**
- **Real-Time Updates**: See when model becomes ready
- **User Feedback**: User knows to wait
- **Error Detection**: Detect model load failures

## Error Handling

### Error Display

**File**: [`frontend/src/components/EditorView.tsx`](../frontend/src/components/EditorView.tsx)

```typescript
{error && (
  <div className="error-toast" onClick={() => setError(null)}>
    <span>Error: {error}</span>
    <span>×</span>
  </div>
)}
```

**Features**:
- **Dismissible**: Click to close
- **Auto-Dismiss**: Auto-dismiss after 5 seconds (see `useEffect`)
- **User-Friendly**: Clear error messages

### Error Recovery

**File**: [`frontend/src/components/EditorView.tsx`](../frontend/src/components/EditorView.tsx)

```typescript
catch (err) {
  setError(err.message);
  
  // If session error, create new session
  if (err.message.includes('Session not found')) {
    try {
      const newSessionId = await createSession();
      setSessionId(newSessionId);
    } catch (createErr) {
      console.error('Failed to create new session:', createErr);
    }
  }
}
```

**Why Error Recovery?**
- **Resilience**: Recover from common errors (session not found)
- **User Experience**: Don't require manual refresh
- **Graceful Degradation**: Continue working despite errors

## Type Safety

### Shared Types

**File**: [`shared/src/types.ts`](../shared/src/types.ts)

Types are defined in `shared/` package, used by both:
- **Backend**: For validation schemas
- **Frontend**: For TypeScript types when consuming API

**Example**:
```typescript
export interface AnalysisResult {
  intent: IntentAnalysis;
  tone: ToneAnalysis;
  impact: ImpactAnalysis;
  alternatives: Alternative[];
}
```

**Benefits**:
- **Type Safety**: TypeScript ensures types match
- **Single Source of Truth**: Change type once, both update
- **Compile-Time Checks**: Catch type mismatches before runtime

### API Response Types

**File**: [`frontend/src/services/api.ts`](../frontend/src/services/api.ts)

```typescript
const response = await apiClient.post<AnalyzeResponse>('/api/analyze', request);

if (response.data.success) {
  return {
    data: response.data.data!, // TypeScript knows this exists if success is true
    sessionId: response.data.sessionId,
  };
}
```

**Why Type Assertions?**
- **Type Safety**: TypeScript knows response structure
- **IntelliSense**: Autocomplete for response fields
- **Compile-Time Checks**: Catch type errors before runtime

## Styling and UX

### CSS Variables

**File**: [`frontend/src/components/App.css`](../frontend/src/components/App.css)

```css
:root {
  --color-primary: #007bff;
  --color-bg-primary: #ffffff;
  --color-text-primary: #333333;
  --color-border: #e0e0e0;
}
```

**Why CSS Variables?**
- **Theming**: Easy to change colors globally
- **Consistency**: Same colors across components
- **Maintainability**: Update once, applies everywhere

### Responsive Design

**File**: [`frontend/src/components/App.css`](../frontend/src/components/App.css)

```css
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

@media (max-width: 768px) {
  .container {
    padding: 10px;
  }
}
```

**Why Responsive?**
- **Mobile Support**: Works on phones, tablets
- **Better UX**: Adapts to screen size
- **Accessibility**: Usable on all devices

## What's Different in Production?

### 1. **State Management**

**This Project**: React `useState`, `useEffect`.

**Production**:
- **State Management Library**: Redux, Zustand, Jotai for complex state
- **Server State**: React Query, SWR for API state management
- **Caching**: Cache API responses, reduce redundant calls
- **Optimistic Updates**: Update UI before API responds

### 2. **Error Handling**

**This Project**: Basic error state, error toast.

**Production**:
- **Error Boundaries**: Catch React errors, prevent crashes
- **Error Tracking**: Sentry, LogRocket for error monitoring
- **Retry Logic**: Automatic retry for failed requests
- **Offline Support**: Queue requests when offline, sync when online

### 3. **Loading States**

**This Project**: Simple loading spinner.

**Production**:
- **Skeleton Screens**: Show content structure while loading
- **Progressive Loading**: Show partial results as they arrive
- **Optimistic UI**: Show expected result immediately, update when confirmed
- **Loading Priorities**: Show critical content first

### 4. **Authentication**

**This Project**: No authentication.

**Production**:
- **Login/Signup**: User authentication flow
- **Protected Routes**: Require authentication for certain pages
- **Token Management**: Store, refresh, expire tokens
- **User Profile**: Display user info, settings

### 5. **Performance Optimization**

**This Project**: Basic React app, no optimization.

**Production**:
- **Code Splitting**: Lazy load components, reduce initial bundle size
- **Memoization**: `useMemo`, `useCallback` to prevent unnecessary re-renders
- **Virtual Scrolling**: For long lists (alternatives, history)
- **Image Optimization**: Lazy load images, use WebP format
- **Bundle Optimization**: Tree shaking, minification, compression

### 6. **Testing**

**This Project**: No tests.

**Production**:
- **Unit Tests**: Test components, utilities in isolation
- **Integration Tests**: Test API integration, user flows
- **E2E Tests**: Test complete user journeys (Cypress, Playwright)
- **Visual Regression**: Test UI changes don't break layout

### 7. **Accessibility**

**This Project**: Basic HTML, no accessibility features.

**Production**:
- **ARIA Labels**: Screen reader support
- **Keyboard Navigation**: Full keyboard support
- **Focus Management**: Proper focus indicators
- **WCAG Compliance**: Meet accessibility standards

### 8. **Analytics**

**This Project**: No analytics.

**Production**:
- **User Analytics**: Track user behavior, feature usage
- **Performance Monitoring**: Track page load times, API latency
- **Error Tracking**: Track errors, user impact
- **A/B Testing**: Test different UI variations

### 9. **Internationalization**

**This Project**: English only.

**Production**:
- **i18n**: Support multiple languages
- **Locale Detection**: Auto-detect user language
- **RTL Support**: Right-to-left languages (Arabic, Hebrew)
- **Date/Time Formatting**: Locale-specific formatting

### 10. **Progressive Web App (PWA)**

**This Project**: Web app only.

**Production**:
- **Service Workers**: Offline support, caching
- **App Manifest**: Installable as app
- **Push Notifications**: Notify users of updates
- **Background Sync**: Sync data when online

