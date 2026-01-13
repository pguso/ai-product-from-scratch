import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getSessionsList, getSessionLogs, type SessionInfo, type LogEntry } from '../services/api';
import './App.css';

const PROMPT_PREVIEW_LENGTH = 50;

function LogsPage() {
  const { sessionId } = useParams<{ sessionId?: string }>();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPrompts, setExpandedPrompts] = useState<Set<number>>(new Set());
  const [expandedResponses, setExpandedResponses] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    if (sessionId) {
      loadLogs(sessionId);
    } else {
      setLogs([]);
    }
  }, [sessionId]);

  const loadSessions = async () => {
    try {
      setLoading(true);
      setError(null);
      const sessionList = await getSessionsList();
      setSessions(sessionList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      const logEntries = await getSessionLogs(id);
      setLogs(logEntries);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load logs');
    } finally {
      setLoading(false);
    }
  };

  const togglePrompt = (index: number) => {
    const newExpanded = new Set(expandedPrompts);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedPrompts(newExpanded);
  };

  const toggleResponse = (index: number) => {
    const newExpanded = new Set(expandedResponses);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedResponses(newExpanded);
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch {
      return timestamp;
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString();
    } catch {
      return dateStr;
    }
  };

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
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600 }}>Logs</h1>
        <Link 
          to="/" 
          style={{ 
            color: 'var(--color-primary)', 
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: 500
          }}
        >
          ← Back to Editor
        </Link>
      </div>
      <div className="container" style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto', marginTop: '80px' }}>

      {error && (
        <div
          style={{
            padding: '12px 16px',
            background: 'var(--color-danger)',
            color: 'white',
            borderRadius: '6px',
            marginBottom: '20px',
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px' }}>
        {/* Sessions List */}
        <div
          style={{
            background: 'var(--color-bg-secondary)',
            borderRadius: '8px',
            padding: '16px',
            height: 'fit-content',
            maxHeight: 'calc(100vh - 120px)',
            overflowY: 'auto',
          }}
        >
          <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 600 }}>
            Sessions
          </h2>
          {loading && !sessions.length ? (
            <div style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>
              Loading sessions...
            </div>
          ) : sessions.length === 0 ? (
            <div style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>
              No sessions found
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {sessions.map((session) => (
                <button
                  key={session.sessionId}
                  onClick={() => navigate(`/logs/${session.sessionId}`)}
                  style={{
                    padding: '12px',
                    background: sessionId === session.sessionId 
                      ? 'var(--color-primary)' 
                      : 'var(--color-bg-tertiary)',
                    color: sessionId === session.sessionId 
                      ? 'white' 
                      : 'var(--color-text-primary)',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: '13px',
                    fontFamily: 'monospace',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (sessionId !== session.sessionId) {
                      e.currentTarget.style.background = 'var(--color-bg-hover)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (sessionId !== session.sessionId) {
                      e.currentTarget.style.background = 'var(--color-bg-tertiary)';
                    }
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                    {session.sessionId.substring(0, 8)}...
                  </div>
                  <div style={{ fontSize: '11px', opacity: 0.8 }}>
                    {formatDate(session.createdAt)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Logs Viewer */}
        <div
          style={{
            background: 'var(--color-bg-secondary)',
            borderRadius: '8px',
            padding: '20px',
            maxHeight: 'calc(100vh - 120px)',
            overflowY: 'auto',
          }}
        >
          {!sessionId ? (
            <div style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: '40px' }}>
              Select a session to view logs
            </div>
          ) : loading ? (
            <div style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: '40px' }}>
              Loading logs...
            </div>
          ) : logs.length === 0 ? (
            <div style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: '40px' }}>
              No logs found for this session
            </div>
          ) : (
            <div>
              <div style={{ marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--color-border)' }}>
                <h2 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 600 }}>
                  Session: {sessionId}
                </h2>
                <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                  {logs.length} log entries
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {logs.map((entry, index) => (
                  <div
                    key={index}
                    style={{
                      background: 'var(--color-bg-tertiary)',
                      borderRadius: '6px',
                      padding: '16px',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                          <span
                            style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 600,
                              textTransform: 'uppercase',
                              background:
                                entry.type === 'request'
                                  ? 'rgba(59, 130, 246, 0.2)'
                                  : entry.type === 'response'
                                  ? 'rgba(34, 197, 94, 0.2)'
                                  : 'rgba(239, 68, 68, 0.2)',
                              color:
                                entry.type === 'request'
                                  ? 'rgb(59, 130, 246)'
                                  : entry.type === 'response'
                                  ? 'rgb(34, 197, 94)'
                                  : 'rgb(239, 68, 68)',
                            }}
                          >
                            {entry.type}
                          </span>
                          {entry.analysisType && (
                            <span
                              style={{
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                background: 'var(--color-bg-secondary)',
                                color: 'var(--color-text-secondary)',
                              }}
                            >
                              {entry.analysisType}
                            </span>
                          )}
                          {entry.attempt && (
                            <span
                              style={{
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                background: 'var(--color-bg-secondary)',
                                color: 'var(--color-text-secondary)',
                              }}
                            >
                              Attempt {entry.attempt}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                          {formatTimestamp(entry.timestamp)}
                        </div>
                      </div>
                      {entry.model && (
                        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                          {entry.model}
                        </div>
                      )}
                    </div>

                    {entry.prompt && (
                      <div style={{ marginTop: '12px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--color-text-primary)' }}>
                          Prompt:
                        </div>
                        <div
                          style={{
                            background: 'var(--color-bg-secondary)',
                            padding: '12px',
                            borderRadius: '4px',
                            fontSize: '13px',
                            fontFamily: 'monospace',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            color: 'var(--color-text-primary)',
                            border: '1px solid var(--color-border)',
                          }}
                        >
                          {expandedPrompts.has(index) || entry.prompt.length <= PROMPT_PREVIEW_LENGTH
                            ? entry.prompt
                            : `${entry.prompt.substring(0, PROMPT_PREVIEW_LENGTH)}...`}
                        </div>
                        {entry.prompt.length > PROMPT_PREVIEW_LENGTH && (
                          <button
                            onClick={() => togglePrompt(index)}
                            style={{
                              marginTop: '6px',
                              padding: '4px 8px',
                              background: 'transparent',
                              border: '1px solid var(--color-border)',
                              borderRadius: '4px',
                              color: 'var(--color-primary)',
                              cursor: 'pointer',
                              fontSize: '12px',
                            }}
                          >
                            {expandedPrompts.has(index) ? 'Show less' : 'Show more'}
                          </button>
                        )}
                      </div>
                    )}

                    {entry.response && (
                      <div style={{ marginTop: '12px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--color-text-primary)' }}>
                          Response:
                        </div>
                        <div
                          style={{
                            background: 'var(--color-bg-secondary)',
                            padding: '12px',
                            borderRadius: '4px',
                            fontSize: '13px',
                            fontFamily: 'monospace',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            color: 'var(--color-text-primary)',
                            border: '1px solid var(--color-border)',
                            maxHeight: expandedResponses.has(index) ? 'none' : '400px',
                            overflowY: expandedResponses.has(index) ? 'visible' : 'auto',
                          }}
                        >
                          {expandedResponses.has(index) || entry.response.length <= PROMPT_PREVIEW_LENGTH
                            ? entry.response
                            : `${entry.response.substring(0, PROMPT_PREVIEW_LENGTH)}...`}
                        </div>
                        {entry.response.length > PROMPT_PREVIEW_LENGTH && (
                          <button
                            onClick={() => toggleResponse(index)}
                            style={{
                              marginTop: '6px',
                              padding: '4px 8px',
                              background: 'transparent',
                              border: '1px solid var(--color-border)',
                              borderRadius: '4px',
                              color: 'var(--color-primary)',
                              cursor: 'pointer',
                              fontSize: '12px',
                            }}
                          >
                            {expandedResponses.has(index) ? 'Show less' : 'Show more'}
                          </button>
                        )}
                      </div>
                    )}

                    {entry.error && (
                      <div style={{ marginTop: '12px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--color-danger)' }}>
                          Error:
                        </div>
                        <div
                          style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            padding: '12px',
                            borderRadius: '4px',
                            fontSize: '13px',
                            color: 'var(--color-danger)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                          }}
                        >
                          {entry.error}
                        </div>
                      </div>
                    )}

                    {entry.options && (
                      <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                        Options:{' '}
                        {entry.options.temperature !== undefined && `Temperature: ${entry.options.temperature}`}
                        {entry.options.temperature !== undefined && entry.options.maxTokens !== undefined && ', '}
                        {entry.options.maxTokens !== undefined && `Max Tokens: ${entry.options.maxTokens}`}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </>
  );
}

export default LogsPage;
