import express from 'express';
import type { AnalyzeRequest, AnalyzeResponse, ApiError } from '@communication-mirror/shared';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Analyze endpoint (placeholder - will be implemented with LLM)
app.post('/api/analyze', (req, res) => {
  const { message } = req.body as AnalyzeRequest;

  if (!message || typeof message !== 'string') {
    const error: ApiError = { error: 'Message is required' };
    res.status(400).json(error);
    return;
  }

  // Placeholder response - will be replaced with actual LLM analysis
  const response: AnalyzeResponse = {
    intent: {
      primary: 'Placeholder intent',
      secondary: 'Placeholder secondary',
      implicit: 'Placeholder implicit',
    },
    tone: {
      summary: 'Analysis pending LLM integration',
      emotions: [{ label: 'Neutral', category: 'neutral' }],
      details: 'This is a placeholder response.',
    },
    impact: {
      metrics: [
        { name: 'Emotional Friction', value: 50, level: 'medium' },
        { name: 'Defensive Response Likelihood', value: 50, level: 'medium' },
        { name: 'Relationship Strain', value: 50, level: 'medium' },
        { name: 'Cooperation Likelihood', value: 50, level: 'medium' },
      ],
      recipientResponse: 'Placeholder recipient response prediction.',
    },
    alternatives: [
      {
        label: 'Option A',
        text: 'Alternative phrasing will appear here.',
        impact: 'Impact description will appear here.',
        tags: [{ label: 'Placeholder', isPositive: true }],
      },
    ],
  };

  res.json(response);
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
