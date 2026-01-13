import { useState, useEffect, useRef } from 'react';
import type { AnalysisResult } from '@shared';
import { EditorPanel } from './EditorPanel';
import { AnalysisPanel } from './AnalysisPanel';
import { analyzeMessage, createSession, getModelStatus } from '../services/api';
import { Link } from 'react-router-dom';
import './App.css';

const SESSION_STORAGE_KEY = 'communication-mirror-session-id';

function EditorView() {
  const [message, setMessage] = useState('I really wanted to talk to you, but you gave me no chance');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [modelPathMissing, setModelPathMissing] = useState(false);
  const sessionInitialized = useRef(false);

  // Check model status and initialize session on mount
  useEffect(() => {
    const initialize = async () => {
      if (sessionInitialized.current) return;
      sessionInitialized.current = true;

      try {
        // Check model status first
        const status = await getModelStatus();
        if (status.modelPathMissing) {
          setModelPathMissing(true);
          setIsInitializing(false);
          return;
        }

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
        const errorMessage = err instanceof Error ? err.message : 'Failed to initialize';
        setError(errorMessage);
        setIsInitializing(false);
        // Try to continue without session - backend will create one
        setSessionId(null);
      }
    };

    initialize();
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
      // Update sessionId (backend may create a new one if none provided)
      if (response.sessionId) {
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


  if (isInitializing) {
    return (
      <>
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          background: 'var(--color-bg-secondary)',
          borderBottom: '1px solid var(--color-border)',
          padding: '16px 20px',
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
        }}>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600 }}>AI Product from Scratch</h1>
          <nav style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
            <Link
              to="/"
              style={{
                color: 'var(--color-text-secondary)',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: 500,
                transition: 'color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-primary)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-secondary)'}
            >
              Home
            </Link>
            <Link
              to="/"
              style={{
                color: 'var(--color-text-secondary)',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: 500,
                transition: 'color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-primary)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-secondary)'}
            >
              ← Back to Editor
            </Link>
            <Link
              to="/logs"
              style={{
                color: 'var(--color-text-secondary)',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: 500,
                transition: 'color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-primary)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-secondary)'}
            >
              Logs
            </Link>
            <Link
              to="/docs"
              style={{
                color: 'var(--color-text-secondary)',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: 500,
                transition: 'color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-primary)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-secondary)'}
            >
              Docs
            </Link>
          </nav>
        </div>
        <div className="container" style={{ marginTop: '60px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: 'calc(100vh - 60px)',
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
      </>
    );
  }

  if (modelPathMissing) {
    return (
      <>
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          background: 'var(--color-bg-secondary)',
          borderBottom: '1px solid var(--color-border)',
          padding: '16px 20px',
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
        }}>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600 }}>AI Product from Scratch</h1>
          <nav style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
            <Link
              to="/"
              style={{
                color: 'var(--color-text-secondary)',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: 500,
                transition: 'color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-primary)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-secondary)'}
            >
              Home
            </Link>
            <Link
              to="/"
              style={{
                color: 'var(--color-text-secondary)',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: 500,
                transition: 'color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-primary)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-secondary)'}
            >
              ← Back to Editor
            </Link>
            <Link
              to="/logs"
              style={{
                color: 'var(--color-text-secondary)',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: 500,
                transition: 'color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-primary)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-secondary)'}
            >
              Logs
            </Link>
            <Link
              to="/docs"
              style={{
                color: 'var(--color-text-secondary)',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: 500,
                transition: 'color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-primary)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-secondary)'}
            >
              Docs
            </Link>
          </nav>
        </div>
        <div className="container" style={{ marginTop: '60px', padding: '40px', maxWidth: '800px', marginLeft: 'auto', marginRight: 'auto' }}>
          <div
            style={{
              background: 'var(--color-bg-secondary)',
              borderRadius: '8px',
              padding: '32px',
              border: '1px solid var(--color-border)',
            }}
          >
            <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: 600, color: 'var(--color-danger)' }}>
              Model File Not Found
            </h2>
            <p style={{ margin: '0 0 24px 0', color: 'var(--color-text-primary)', lineHeight: '1.6' }}>
              No GGUF model file has been configured. Please download a model file and configure the <code style={{ background: 'var(--color-bg-tertiary)', padding: '2px 6px', borderRadius: '4px', fontSize: '13px' }}>MODEL_PATH</code> environment variable in <code style={{ background: 'var(--color-bg-tertiary)', padding: '2px 6px', borderRadius: '4px', fontSize: '13px' }}>backend/.env</code>.
            </p>
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 600 }}>Quick Start - Download Qwen3 4B Model:</h3>
              <p style={{ margin: '0 0 12px 0', color: 'var(--color-text-secondary)', fontSize: '14px' }}>
                Download the recommended model:
              </p>
              <a
                href="https://huggingface.co/unsloth/Qwen3-4B-Instruct-2507-GGUF/resolve/main/Qwen3-4B-Instruct-2507-Q6_K.gguf"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block',
                  padding: '12px 20px',
                  background: 'var(--color-primary)',
                  color: 'white',
                  textDecoration: 'none',
                  borderRadius: '6px',
                  fontWeight: 500,
                  fontSize: '14px',
                  marginBottom: '12px',
                }}
              >
                Download Qwen3-4B-Instruct-2507-Q6_K.gguf →
              </a>
              <p style={{ margin: '12px 0 0 0', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                After downloading, place the file in <code style={{ background: 'var(--color-bg-tertiary)', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>backend/models/</code> and set <code style={{ background: 'var(--color-bg-tertiary)', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>MODEL_PATH=./models/Qwen3-4B-Instruct-2507-Q6_K.gguf</code> in <code style={{ background: 'var(--color-bg-tertiary)', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>backend/.env</code>.
              </p>
            </div>
            <div style={{ padding: '16px', background: 'var(--color-bg-tertiary)', borderRadius: '6px', border: '1px solid var(--color-border)' }}>
              <p style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 500, color: 'var(--color-text-primary)' }}>
                Other Models Available
              </p>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: '1.6' }}>
                You can download other compatible models from Hugging Face. For detailed instructions on model selection, download links, and configuration, see the <strong>README.md</strong> file in this repository.
              </p>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        background: 'var(--color-bg-secondary)',
        borderBottom: '1px solid var(--color-border)',
        padding: '16px 20px',
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
      }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600 }}>AI Product from Scratch</h1>
        <nav style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
          <Link
            to="/"
            style={{
              color: 'var(--color-text-secondary)',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 500,
              transition: 'color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-primary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-secondary)'}
          >
            Home
          </Link>
          <Link
            to="/logs"
            style={{
              color: 'var(--color-text-secondary)',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 500,
              transition: 'color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-primary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-secondary)'}
          >
            Logs
          </Link>
          <Link
            to="/docs"
            style={{
              color: 'var(--color-text-secondary)',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 500,
              transition: 'color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-primary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-secondary)'}
          >
            Docs
          </Link>
        </nav>
      </div>
      <div className="container" style={{ marginTop: '60px' }}>
        <EditorPanel
        message={message}
        onMessageChange={setMessage}
        onAnalyze={handleAnalyze}
        isLoading={isLoading}
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
    </>
  );
}

export default EditorView;
