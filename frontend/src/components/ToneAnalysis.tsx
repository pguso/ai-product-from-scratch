import type { ToneAnalysis as ToneAnalysisType, Emotion } from '@shared';
import './App.css';

interface ToneAnalysisProps {
  tone: ToneAnalysisType;
}

export function ToneAnalysis({ tone }: ToneAnalysisProps) {
  return (
    <div className="analysis-section">
      <div className="section-header">
        <div className="section-icon">•</div>
        <div className="section-title">Tone Analysis</div>
      </div>
      <div className="section-content">
        <p>{tone.summary}</p>
        <div className="emotion-tags">
          {tone.emotions.map((emotion: Emotion, index: number) => (
            <div key={index} className={`emotion-tag ${emotion.sentiment}`}>
              {emotion.text}
            </div>
          ))}
        </div>
        <div className="detail-text" dangerouslySetInnerHTML={{ __html: tone.details }} />
      </div>
    </div>
  );
}
