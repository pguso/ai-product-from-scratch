import type { Alternative } from '@shared';
import './App.css';

interface AlternativesProps {
  alternatives: Alternative[];
  onSelect?: (alternative: Alternative) => void;
}

export function Alternatives({ alternatives, onSelect }: AlternativesProps) {
  return (
    <div className="analysis-section">
      <div className="section-header">
        <div className="section-icon">•</div>
        <div className="section-title">Alternative Approaches</div>
      </div>
      <div className="section-content">
        <div className="alternative-cards">
          {alternatives.map((alternative, index) => (
            <div
              key={index}
              className="alternative-card"
              onClick={() => onSelect?.(alternative)}
            >
              <div className="alternative-badge">{alternative.badge}</div>
              <div className="alternative-text">{alternative.text}</div>
              <div className="alternative-reason">
                <strong>Impact:</strong> {alternative.reason}
              </div>
              <div className="alternative-tags">
                {alternative.tags.map((tag, tagIndex) => (
                  <span key={tagIndex} className={`alt-tag ${tag.isPositive ? 'positive' : ''}`}>
                    {tag.text}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
