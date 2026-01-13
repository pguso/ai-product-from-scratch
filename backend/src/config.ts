/**
 * Application Configuration
 * 
 * Centralizes all configuration values from environment variables
 * with sensible defaults for development.
 */

export const config = {
  port: Number(process.env.PORT) || 3001,
  modelPath: process.env.MODEL_PATH || './models/model.gguf',
  maxMessageLength: 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
} as const;
