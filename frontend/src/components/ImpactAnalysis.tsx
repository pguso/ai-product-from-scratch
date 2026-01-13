import { useEffect, useRef } from 'react';
import type { ImpactAnalysis as ImpactAnalysisType, ImpactMetric } from '@shared';
import './App.css';

interface ImpactAnalysisProps {
  impact: ImpactAnalysisType;
}

export function ImpactAnalysis({ impact }: ImpactAnalysisProps) {
  const fillRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    // Animate impact bars after DOM is ready
    const timeoutId = setTimeout(() => {
      impact.metrics.forEach((metric: ImpactMetric, index: number) => {
        const fill = fillRefs.current[index];
        if (fill && metric.value !== undefined && !isNaN(metric.value)) {
          // Store the target width from the metric value (ensure it's between 0-100)
          const clampedValue = Math.max(0, Math.min(100, metric.value));
          const targetWidth = `${clampedValue}%`;
          // Reset to 0 first
          fill.style.width = '0%';
          // Force reflow to ensure the reset is applied
          void fill.offsetHeight;
          // Animate to target width using requestAnimationFrame for smooth animation
          requestAnimationFrame(() => {
            fill.style.width = targetWidth;
          });
        }
      });
    }, 150);
    
    return () => clearTimeout(timeoutId);
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
          {impact.metrics.map((metric: ImpactMetric, index: number) => (
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
                  ref={(el) => {
                    fillRefs.current[index] = el;
                  }}
                  className={`impact-fill ${getFillClass(metric.category)}`}
                  style={{ width: '0%' }}
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
