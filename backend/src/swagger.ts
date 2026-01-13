import swaggerJsdoc from 'swagger-jsdoc';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Communication Mirror API',
      version: '1.0.0',
      description: 'API for analyzing communication messages to understand emotional impact and intent',
      contact: {
        name: 'Communication Mirror',
      },
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 3001}`,
        description: 'Development server',
      },
    ],
    tags: [
      {
        name: 'Health',
        description: 'Health check endpoints',
      },
      {
        name: 'Status',
        description: 'Service status and model information',
      },
      {
        name: 'Analysis',
        description: 'Message analysis endpoints',
      },
    ],
    components: {
      schemas: {
        AnalyzeRequest: {
          type: 'object',
          required: ['message'],
          properties: {
            message: {
              type: 'string',
              description: 'The message to analyze',
              maxLength: 5000,
              example: 'Can you finally send the document today?',
            },
            sessionId: {
              type: 'string',
              description: 'Optional session ID for conversation context. If omitted, a new session will be created automatically and returned in the response. Use the returned sessionId in subsequent requests to maintain conversation context. You can also create a session explicitly using POST /api/sessions.',
              example: '550e8400-e29b-41d4-a716-446655440000',
            },
          },
        },
        IntentAnalysis: {
          type: 'object',
          properties: {
            primary: {
              type: 'string',
              description: 'The primary stated intent',
              example: 'Request document delivery',
            },
            secondary: {
              type: 'string',
              description: 'The secondary supporting goal',
              example: 'Signal urgency',
            },
            implicit: {
              type: 'string',
              description: 'The unstated emotional or relational goal',
              example: 'Express frustration',
            },
          },
        },
        Emotion: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'Emotion label',
              example: 'Impatient',
            },
            sentiment: {
              type: 'string',
              enum: ['positive', 'neutral', 'negative'],
              description: 'Emotion sentiment category',
              example: 'negative',
            },
          },
        },
        ToneAnalysis: {
          type: 'object',
          properties: {
            summary: {
              type: 'string',
              description: 'One-sentence overview of the overall tone',
              example: 'The message carries several emotional signals that may create friction.',
            },
            emotions: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/Emotion',
              },
            },
            details: {
              type: 'string',
              description: 'Specific observations about word choice and phrasing',
              example: 'The word "finally" implies they should have acted sooner.',
            },
          },
        },
        ImpactMetric: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Name of the impact metric',
              example: 'Emotional Friction',
            },
            value: {
              type: 'integer',
              minimum: 0,
              maximum: 100,
              description: 'Metric value from 0-100',
              example: 80,
            },
            category: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
              description: 'Impact category',
              example: 'high',
            },
          },
        },
        ImpactAnalysis: {
          type: 'object',
          properties: {
            metrics: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/ImpactMetric',
              },
            },
            recipientResponse: {
              type: 'string',
              description: 'Prediction of how the recipient might respond',
              example: 'The recipient may feel blamed for delays, triggering a defensive response.',
            },
          },
        },
        AlternativeTag: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'Tag label',
              example: 'Collaborative',
            },
            isPositive: {
              type: 'boolean',
              description: 'Whether this is a positive trait',
              example: true,
            },
          },
        },
        Alternative: {
          type: 'object',
          properties: {
            badge: {
              type: 'string',
              description: 'Alternative option label',
              example: 'Option A',
            },
            text: {
              type: 'string',
              description: 'The reworded message',
              example: "Do you think you'll be able to send the document today?",
            },
            reason: {
              type: 'string',
              description: 'Why this version improves on the original',
              example: 'Removes accusatory tone by framing as a question about capability.',
            },
            tags: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/AlternativeTag',
              },
            },
          },
        },
        AnalysisResult: {
          type: 'object',
          properties: {
            intent: {
              $ref: '#/components/schemas/IntentAnalysis',
            },
            tone: {
              $ref: '#/components/schemas/ToneAnalysis',
            },
            impact: {
              $ref: '#/components/schemas/ImpactAnalysis',
            },
            alternatives: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/Alternative',
              },
            },
          },
        },
        AnalyzeResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            data: {
              $ref: '#/components/schemas/AnalysisResult',
            },
            sessionId: {
              type: 'string',
              description: 'Session ID for conversation context. Use this in subsequent requests to maintain context.',
              example: '550e8400-e29b-41d4-a716-446655440000',
            },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            error: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  example: 'INVALID_REQUEST',
                },
                message: {
                  type: 'string',
                  example: 'Message is required and must be a string',
                },
                details: {
                  type: 'string',
                  description: 'Additional error details (only in development)',
                },
              },
            },
          },
        },
        StatusResponse: {
          type: 'object',
          properties: {
            modelReady: {
              type: 'boolean',
              description: 'Whether the model is loaded and ready',
              example: true,
            },
            modelLoading: {
              type: 'boolean',
              description: 'Whether the model is currently loading',
              example: false,
            },
            modelPath: {
              type: 'string',
              description: 'Path to the model file',
              example: './models/model.gguf',
            },
            error: {
              type: 'object',
              nullable: true,
              properties: {
                message: {
                  type: 'string',
                },
                stack: {
                  type: 'string',
                },
              },
            },
          },
        },
        HealthResponse: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              example: 'ok',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T00:00:00.000Z',
            },
            service: {
              type: 'string',
              example: 'communication-mirror-backend',
            },
          },
        },
      },
    },
  },
  apis: [
    join(__dirname, '**/*.ts'),
    join(__dirname, 'routes/**/*.ts'),
  ], // Path to the API files (relative to this file's directory)
};

export const swaggerSpec = swaggerJsdoc(options);
