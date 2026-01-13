import { Router, Request, Response } from 'express';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { ErrorResponse } from '@shared';
import type { LLMLogEntry } from '../../lib/llm-logger.js';

/**
 * Logs Routes
 * 
 * Provides endpoints for viewing LLM logs:
 * - List all session IDs with their log files
 * - Get formatted logs for a specific session
 */

interface SessionInfo {
  sessionId: string;
  logFile: string;
  createdAt: string;
  lastModified: string;
}

interface LogEntryResponse {
  timestamp: string;
  type: 'request' | 'response' | 'error';
  analysisType?: 'intent' | 'tone' | 'impact' | 'alternatives';
  prompt?: string;
  response?: string;
  error?: string;
  attempt?: number;
  model?: string;
  options?: {
    temperature?: number;
    maxTokens?: number;
  };
}

/**
 * Parse log file content into structured entries
 */
function parseLogFile(content: string): LogEntryResponse[] {
  const entries: LogEntryResponse[] = [];
  const sections = content.split('---\n').filter(s => s.trim());

  for (const section of sections) {
    // Skip header section
    if (section.includes('LLM Session Log') || section.includes('Session ID:')) {
      continue;
    }

    const lines = section.split('\n').filter(l => l.trim());
    if (lines.length === 0) continue;

    const entry: LogEntryResponse = {
      timestamp: '',
      type: 'request',
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Parse timestamp and type
      const timestampMatch = line.match(/^\[([^\]]+)\]\s+(\w+)/);
      if (timestampMatch) {
        entry.timestamp = timestampMatch[1];
        const typeStr = timestampMatch[2].toLowerCase();
        if (typeStr === 'request' || typeStr === 'response' || typeStr === 'error') {
          entry.type = typeStr as 'request' | 'response' | 'error';
        }
        
        // Extract analysis type and attempt from the same line
        const analysisMatch = line.match(/\((\w+)\)/);
        if (analysisMatch) {
          const analysisType = analysisMatch[1];
          if (['intent', 'tone', 'impact', 'alternatives'].includes(analysisType)) {
            entry.analysisType = analysisType as 'intent' | 'tone' | 'impact' | 'alternatives';
          }
        }
        
        const attemptMatch = line.match(/\[Attempt\s+(\d+)\]/);
        if (attemptMatch) {
          entry.attempt = parseInt(attemptMatch[1], 10);
        }
        continue;
      }

      // Parse model
      if (line.startsWith('Model:')) {
        entry.model = line.substring(6).trim();
        continue;
      }

      // Parse options
      if (line.startsWith('Options:')) {
        const optionsStr = line.substring(8).trim();
        entry.options = {};
        const tempMatch = optionsStr.match(/temperature=([\d.]+)/);
        if (tempMatch) {
          entry.options.temperature = parseFloat(tempMatch[1]);
        }
        const maxTokensMatch = optionsStr.match(/maxTokens=(\d+)/);
        if (maxTokensMatch) {
          entry.options.maxTokens = parseInt(maxTokensMatch[1], 10);
        }
        continue;
      }

      // Parse prompt
      if (line.startsWith('Prompt:')) {
        i++; // Move to next line
        const promptLines: string[] = [];
        while (i < lines.length && lines[i].startsWith('  ') && !lines[i].startsWith('  ---')) {
          promptLines.push(lines[i].substring(2));
          i++;
        }
        i--; // Adjust for loop increment
        if (promptLines.length > 0) {
          entry.prompt = promptLines.join('\n');
        }
        continue;
      }

      // Parse response
      if (line.startsWith('Response:')) {
        i++; // Move to next line
        const responseLines: string[] = [];
        while (i < lines.length && lines[i].startsWith('  ') && !lines[i].startsWith('  ---')) {
          responseLines.push(lines[i].substring(2));
          i++;
        }
        i--; // Adjust for loop increment
        if (responseLines.length > 0) {
          entry.response = responseLines.join('\n');
        }
        continue;
      }

      // Parse error
      if (line.startsWith('Error:')) {
        entry.error = line.substring(6).trim();
        continue;
      }
    }

    if (entry.timestamp) {
      entries.push(entry);
    }
  }

  return entries;
}

/**
 * Extract session ID from log filename
 * Format: session-{sessionId}-{timestamp}.log
 */
function extractSessionId(filename: string): string | null {
  const match = filename.match(/^session-(.+?)-/);
  return match ? match[1] : null;
}

/**
 * @swagger
 * /api/logs:
 *   get:
 *     summary: List all session IDs with log files
 *     description: Returns a list of all sessions that have log files, sorted by creation date.
 *     tags: [Logs]
 *     responses:
 *       200:
 *         description: List of sessions with logs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 sessions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       sessionId:
 *                         type: string
 *                       logFile:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                       lastModified:
 *                         type: string
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
export function createLogsRouter(logDir: string = './logs'): Router {
  const router = Router();

  router.get('/api/logs', async (_req: Request, res: Response) => {
    try {
      // Ensure log directory exists
      try {
        await fs.access(logDir);
      } catch {
        // Directory doesn't exist, return empty list
        res.json({
          success: true,
          sessions: [],
        });
        return;
      }

      // Read all files in log directory
      const files = await fs.readdir(logDir);
      const logFiles = files.filter(f => f.endsWith('.log'));

      const sessions: SessionInfo[] = [];

      for (const file of logFiles) {
        const sessionId = extractSessionId(file);
        if (!sessionId) continue;

        const filePath = path.join(logDir, file);
        const stats = await fs.stat(filePath);

        // Check if we already have this session (multiple log files per session possible)
        const existingIndex = sessions.findIndex(s => s.sessionId === sessionId);
        if (existingIndex >= 0) {
          // Use the most recent file for this session
          const existing = sessions[existingIndex];
          if (stats.mtime > new Date(existing.lastModified)) {
            sessions[existingIndex] = {
              sessionId,
              logFile: file,
              createdAt: stats.birthtime.toISOString(),
              lastModified: stats.mtime.toISOString(),
            };
          }
        } else {
          sessions.push({
            sessionId,
            logFile: file,
            createdAt: stats.birthtime.toISOString(),
            lastModified: stats.mtime.toISOString(),
          });
        }
      }

      // Sort by creation date (newest first)
      sessions.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      res.json({
        success: true,
        sessions,
      });
    } catch (error) {
      console.error('[Logs] Error listing sessions:', error);
      const errorResponse: ErrorResponse = {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to list sessions',
        },
      };
      res.status(500).json(errorResponse);
    }
  });

  /**
   * @swagger
   * /api/logs/{sessionId}:
   *   get:
   *     summary: Get logs for a specific session
   *     description: Returns formatted log entries for a session, with prompts truncated to 50 characters by default.
   *     tags: [Logs]
   *     parameters:
   *       - in: path
   *         name: sessionId
   *         required: true
   *         schema:
   *           type: string
   *         description: The session ID to retrieve logs for
   *     responses:
   *       200:
   *         description: Log entries for the session
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 sessionId:
   *                   type: string
   *                 entries:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       timestamp:
   *                         type: string
   *                       type:
   *                         type: string
   *                         enum: [request, response, error]
   *                       analysisType:
   *                         type: string
   *                         enum: [intent, tone, impact, alternatives]
   *                       prompt:
   *                         type: string
   *                       response:
   *                         type: string
   *                       error:
   *                         type: string
   *                       attempt:
   *                         type: number
   *                       model:
   *                         type: string
   *                       options:
   *                         type: object
   *       404:
   *         description: Session logs not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  router.get('/api/logs/:sessionId', async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;

      // Ensure log directory exists
      try {
        await fs.access(logDir);
      } catch {
        const error: ErrorResponse = {
          success: false,
          error: {
            code: 'LOGS_NOT_FOUND',
            message: 'Log directory not found',
          },
        };
        res.status(404).json(error);
        return;
      }

      // Find log files for this session
      const files = await fs.readdir(logDir);
      const sessionLogFiles = files.filter(f => 
        f.endsWith('.log') && extractSessionId(f) === sessionId
      );

      if (sessionLogFiles.length === 0) {
        const error: ErrorResponse = {
          success: false,
          error: {
            code: 'SESSION_NOT_FOUND',
            message: 'No logs found for this session',
          },
        };
        res.status(404).json(error);
        return;
      }

      // Read the most recent log file for this session
      let latestFile = sessionLogFiles[0];
      let latestTime = 0;

      for (const file of sessionLogFiles) {
        const filePath = path.join(logDir, file);
        const stats = await fs.stat(filePath);
        const mtime = stats.mtime.getTime();
        if (mtime > latestTime) {
          latestTime = mtime;
          latestFile = file;
        }
      }

      const filePath = path.join(logDir, latestFile);
      const content = await fs.readFile(filePath, 'utf-8');
      const entries = parseLogFile(content);

      res.json({
        success: true,
        sessionId,
        entries,
      });
    } catch (error) {
      console.error('[Logs] Error reading session logs:', error);
      const errorResponse: ErrorResponse = {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to read logs',
        },
      };
      res.status(500).json(errorResponse);
    }
  });

  return router;
}
