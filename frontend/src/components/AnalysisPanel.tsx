import type { AnalysisResult } from '@shared';
import { IntentAnalysis } from './IntentAnalysis';
import { ToneAnalysis } from './ToneAnalysis';
import { ImpactAnalysis } from './ImpactAnalysis';
import { Alternatives } from './Alternatives';
import './App.css';

interface AnalysisPanelProps {
  analysis: AnalysisResult | null;
  isLoading: boolean;
}

function LoadingSection({ title }: { title: string }) {
  return (
    <div className="analysis-section">
      <div className="section-header">
        <div className="section-icon">•</div>
        <div className="section-title">{title}</div>
      </div>
      <div className="section-content">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            color: 'var(--color-text-tertiary)',
          }}
        >
          <div
            className="loading-spinner"
            style={{
              width: '20px',
              height: '20px',
              border: '3px solid var(--color-bg-tertiary)',
              borderTop: '3px solid var(--color-primary)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <span>Analyzing...</span>
        </div>
      </div>
    </div>
  );
}

export function AnalysisPanel({ analysis, isLoading }: AnalysisPanelProps) {
  if (isLoading && !analysis) {
    return (
      <div className="analysis-panel">
        <LoadingSection title="Intent Detection" />
        <LoadingSection title="Tone Analysis" />
        <LoadingSection title="Predicted Recipient Impact" />
        <LoadingSection title="Alternative Approaches" />
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="analysis-panel">
        <div className="analysis-section">
          <div className="section-content">
            <p style={{ color: 'var(--color-text-secondary)', lineHeight: 1.8 }}>
              Enter a message and click "Analyze Communication" to see the analysis results.
            </p>
            <p
              style={{
                marginTop: '16px',
                fontSize: '14px',
                color: 'var(--color-text-tertiary)',
              }}
            >
              The analysis will show you the intent, tone, predicted impact, and suggest
              alternative phrasings to improve your communication.
            </p>
          </div>
        </div>
      </div>
    );
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
