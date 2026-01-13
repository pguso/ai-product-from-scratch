import { useState, useEffect, useRef } from 'react';
import type { AnalysisResult } from '@shared';
import { EditorPanel } from './components/EditorPanel';
import { AnalysisPanel } from './components/AnalysisPanel';
import { analyzeMessage, createSession } from './services/api';
import './components/App.css';

const SESSION_STORAGE_KEY = 'communication-mirror-session-id';

function App() {
  const [message, setMessage] = useState('Can you finally send the document today?');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const sessionInitialized = useRef(false);

  // Initialize session on mount
  useEffect(() => {
    const initializeSession = async () => {
      if (sessionInitialized.current) return;
      sessionInitialized.current = true;

      try {
        // Try to load existing session from localStorage
        const stored = localStorage.getItem(SESSION_STORAGE_KEY);
        
        if (stored) {
          // Validate the stored session exists (optional - we'll let the backend validate)
          setSessionId(stored);
          setIsInitializing(false);
        } else {
          // Create a new session
          const newSessionId = await createSession();
          setSessionId(newSessionId);
          localStorage.setItem(SESSION_STORAGE_KEY, newSessionId);
          setIsInitializing(false);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to initialize session';
        setError(errorMessage);
        setIsInitializing(false);
        // Try to continue without session - backend will create one
        setSessionId(null);
      }
    };

    initializeSession();
  }, []);

  // Persist sessionId to localStorage whenever it changes (but not during initialization)
  useEffect(() => {
    if (!isInitializing && sessionId) {
      localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
    } else if (!isInitializing && !sessionId) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, [sessionId, isInitializing]);

  // Auto-dismiss error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleAnalyze = async (messageToAnalyze: string) => {
    // Wait for session to be initialized
    if (isInitializing) {
      setError('Please wait for the session to initialize...');
      return;
    }

    // Ensure we have a session ID
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      try {
        currentSessionId = await createSession();
        setSessionId(currentSessionId);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to create session';
        setError(errorMessage);
        return;
      }
    }

    setIsLoading(true);
    setError(null);
    setMessage(messageToAnalyze);

    try {
      const response = await analyzeMessage(messageToAnalyze, currentSessionId);
      setAnalysis(response.data);
      // Update sessionId if it changed (shouldn't happen, but just in case)
      if (response.sessionId !== currentSessionId) {
        setSessionId(response.sessionId);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to analyze message';
      setError(errorMessage);
      setAnalysis(null);
      
      // If session error, create a new session
      if (errorMessage.includes('Session not found') || errorMessage.includes('INVALID_SESSION')) {
        try {
          const newSessionId = await createSession();
          setSessionId(newSessionId);
        } catch (createErr) {
          console.error('Failed to create new session:', createErr);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewConversation = async () => {
    try {
      const newSessionId = await createSession();
      setSessionId(newSessionId);
      setAnalysis(null);
      setError(null);
      setMessage('');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create new session';
      setError(errorMessage);
    }
  };

  if (isInitializing) {
    return (
      <div className="container">
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          <div
            className="loading-spinner"
            style={{
              width: '40px',
              height: '40px',
              border: '4px solid var(--color-bg-tertiary)',
              borderTop: '4px solid var(--color-primary)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <p style={{ color: 'var(--color-text-secondary)' }}>Initializing session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <EditorPanel
        message={message}
        onMessageChange={setMessage}
        onAnalyze={handleAnalyze}
        onNewConversation={handleNewConversation}
        isLoading={isLoading}
        hasSession={!!sessionId}
      />
      <AnalysisPanel analysis={analysis} isLoading={isLoading} />
      {error && (
        <div
          className="error-toast"
          onClick={() => setError(null)}
          style={{
            position: 'fixed',
            top: 20,
            right: 20,
            padding: '16px 24px',
            background: 'var(--color-danger)',
            color: 'white',
            borderRadius: '6px',
            fontFamily: 'Inter, sans-serif',
            fontSize: '14px',
            zIndex: 1000,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            maxWidth: '400px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
            <span>Error: {error}</span>
            <span style={{ fontSize: '18px', lineHeight: 1 }}>×</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
