import { useEffect, useRef } from 'react';
import type { ImpactAnalysis as ImpactAnalysisType } from '@shared';
import './App.css';

interface ImpactAnalysisProps {
  impact: ImpactAnalysisType;
}

export function ImpactAnalysis({ impact }: ImpactAnalysisProps) {
  const fillRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    // Animate impact bars
    setTimeout(() => {
      fillRefs.current.forEach((fill) => {
        if (fill) {
          const width = fill.style.width;
          fill.style.width = '0';
          setTimeout(() => {
            fill.style.width = width;
          }, 100);
        }
      });
    }, 300);
  }, [impact]);

  const getFillClass = (category: string) => {
    if (category === 'high') return 'fill-high';
    if (category === 'medium') return 'fill-medium';
    return 'fill-low';
  };

  return (
    <div className="analysis-section">
      <div className="section-header">
        <div className="section-icon">•</div>
        <div className="section-title">Predicted Recipient Impact</div>
      </div>
      <div className="section-content">
        <div className="impact-list">
          {impact.metrics.map((metric, index) => (
            <div key={index} className="impact-item">
              <div className="impact-header">
                <div className="impact-name">{metric.name}</div>
                <div className="impact-value">
                  {metric.category.charAt(0).toUpperCase() + metric.category.slice(1)} (
                  {metric.value}%)
                </div>
              </div>
              <div className="impact-bar">
                <div
                  ref={(el) => (fillRefs.current[index] = el)}
                  className={`impact-fill ${getFillClass(metric.category)}`}
                  style={{ width: `${metric.value}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="recipient-box">
          <div className="recipient-header">
            <span>⚠</span>
            <span>Likely Recipient Response</span>
          </div>
          <div className="recipient-text">{impact.recipientResponse}</div>
        </div>
      </div>
    </div>
  );
}
