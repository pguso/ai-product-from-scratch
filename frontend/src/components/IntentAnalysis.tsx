import type { IntentAnalysis as IntentAnalysisType } from '@shared';
import './App.css';

interface IntentAnalysisProps {
  intent: IntentAnalysisType;
}

export function IntentAnalysis({ intent }: IntentAnalysisProps) {
  return (
    <div className="analysis-section">
      <div className="section-header">
        <div className="section-icon">•</div>
        <div className="section-title">Intent Detection</div>
      </div>
      <div className="section-content">
        <div className="intent-grid">
          <div className="intent-card">
            <div className="intent-label">Primary</div>
            <div className="intent-value">{intent.primary}</div>
          </div>
          <div className="intent-card">
            <div className="intent-label">Secondary</div>
            <div className="intent-value">{intent.secondary}</div>
          </div>
          <div className="intent-card">
            <div className="intent-label">Implicit</div>
            <div className="intent-value">{intent.implicit}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
