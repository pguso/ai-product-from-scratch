import { useState, useRef, useEffect } from 'react';
import './App.css';

interface EditorPanelProps {
  message: string;
  onMessageChange: (message: string) => void;
  onAnalyze: (message: string) => void;
  onNewConversation: () => void;
  isLoading: boolean;
  hasSession: boolean;
}

export function EditorPanel({
  message,
  onMessageChange,
  onAnalyze,
  onNewConversation,
  isLoading,
  hasSession,
}: EditorPanelProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [message]);

  const handleAnalyze = () => {
    if (message.trim() && !isLoading) {
      onAnalyze(message.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Allow Ctrl/Cmd + Enter to trigger analysis
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleAnalyze();
    }
  };

  return (
    <div className="editor-panel">
      <div className="header">
        <div className="logo">
          <div className="logo-text">Communication Mirror</div>
        </div>
        <div className="tagline">
          Understand how your message may be emotionally perceived, before you send it.
        </div>
      </div>

      <div className="editor-container">
        <div className="editor-label">Your Message</div>
        <textarea
          ref={textareaRef}
          className="message-editor"
          placeholder="Type or paste your message here..."
          value={message}
          onChange={(e) => onMessageChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
        />
        <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
          <button
            className="analyze-button"
            onClick={handleAnalyze}
            disabled={isLoading || !message.trim()}
          >
            {isLoading ? 'Analyzing...' : 'Analyze Communication'}
          </button>
          {hasSession && (
            <button
              className="new-conversation-button"
              onClick={onNewConversation}
              disabled={isLoading}
              style={{
                padding: '14px 24px',
                background: 'transparent',
                border: '1px solid var(--color-border-strong)',
                borderRadius: '6px',
                color: 'var(--color-text-secondary)',
                fontSize: '14px',
                fontWeight: '600',
                fontFamily: 'Inter, sans-serif',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--color-bg-tertiary)';
                e.currentTarget.style.borderColor = 'var(--color-border-strong)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = 'var(--color-border-strong)';
              }}
            >
              New Conversation
            </button>
          )}
        </div>

        <div className="info-box">
          <strong>Note:</strong> This tool analyzes your message to help you understand its
          emotional impact—it does not rewrite it for you.
        </div>
      </div>
    </div>
  );
}
