import { Router, Request, Response } from 'express';
import { readFile, access } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Find the lessons directory by trying multiple possible paths
 */
async function findLessonsPath(): Promise<string> {
  // Try different possible paths
  const possiblePaths = [
    // From compiled dist: backend/dist/src/routes -> project root
    join(__dirname, '..', '..', '..', 'lessons'),
    // From source: backend/src/routes -> project root
    join(__dirname, '..', '..', '..', 'lessons'),
    // From process.cwd() (if running from project root)
    join(process.cwd(), 'lessons'),
    // From process.cwd() (if running from backend directory)
    join(process.cwd(), '..', 'lessons'),
  ];

  for (const path of possiblePaths) {
    try {
      await access(path);
      console.log('[Docs] Found lessons directory at:', path);
      return path;
    } catch {
      // Path doesn't exist, try next one
      continue;
    }
  }

  // If none found, return the first one (will error with better message)
  console.warn('[Docs] Could not find lessons directory, trying:', possiblePaths[0]);
  return possiblePaths[0];
}

/**
 * Docs route
 * 
 * Serves lesson markdown files from the lessons directory
 */
export function createDocsRouter(): Router {
  const router = Router();
  let lessonsPath: string | null = null;
  
  // Initialize lessons path (async, but we'll handle it in the route)
  findLessonsPath().then(path => {
    lessonsPath = path;
  }).catch(err => {
    console.error('[Docs] Failed to find lessons path:', err);
  });

  /**
   * Get list of available lessons
   */
  router.get('/api/docs/lessons', async (_req: Request, res: Response) => {
    try {
      const lessons = [
        { id: '01-introduction', title: 'Introduction', filename: '01-introduction.md' },
        { id: '02-local-llm-basics', title: 'Local LLM Basics', filename: '02-local-llm-basics.md' },
        { id: '03-prompt-engineering', title: 'Prompt Engineering', filename: '03-prompt-engineering.md' },
        { id: '04-structured-output', title: 'Structured Output', filename: '04-structured-output.md' },
        { id: '05-multi-step-reasoning', title: 'Multi-Step Reasoning', filename: '05-multi-step-reasoning.md' },
        { id: '06-api-design', title: 'API Design', filename: '06-api-design.md' },
        { id: '07-frontend-integration', title: 'Frontend Integration', filename: '07-frontend-integration.md' },
        { id: '08-session-management', title: 'Session Management', filename: '08-session-management.md' },
        { id: '09-validation-error-handling', title: 'Validation & Error Handling', filename: '09-validation-error-handling.md' },
        { id: '10-trade-offs-lessons', title: 'Trade-offs & Lessons', filename: '10-trade-offs-lessons.md' },
      ];

      res.json({
        success: true,
        lessons,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to fetch lessons list',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  });

  // Map lesson IDs to filenames (defined outside route handler for error handling)
  const lessonMap: Record<string, string> = {
    '01-introduction': '01-introduction.md',
    '02-local-llm-basics': '02-local-llm-basics.md',
    '03-prompt-engineering': '03-prompt-engineering.md',
    '04-structured-output': '04-structured-output.md',
    '05-multi-step-reasoning': '05-multi-step-reasoning.md',
    '06-api-design': '06-api-design.md',
    '07-frontend-integration': '07-frontend-integration.md',
    '08-session-management': '08-session-management.md',
    '09-validation-error-handling': '09-validation-error-handling.md',
    '10-trade-offs-lessons': '10-trade-offs-lessons.md',
  };

  /**
   * Get a specific lesson by ID
   */
  router.get('/api/docs/lessons/:lessonId', async (req: Request, res: Response) => {
    try {
      const { lessonId } = req.params;

      const filename = lessonMap[lessonId];
      if (!filename) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Lesson not found',
          },
        });
      }

      // Ensure lessons path is resolved
      const resolvedLessonsPath = lessonsPath || await findLessonsPath();
      if (!lessonsPath) {
        lessonsPath = resolvedLessonsPath; // Cache it for next time
      }
      const filePath = join(resolvedLessonsPath, filename);
      
      // Debug logging (can be removed in production)
      console.log('[Docs] Attempting to read lesson:', {
        lessonId,
        filename,
        lessonsPath: resolvedLessonsPath,
        filePath,
      });
      
      const content = await readFile(filePath, 'utf-8');

      res.json({
        success: true,
        lesson: {
          id: lessonId,
          filename,
          content,
        },
      });
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        const resolvedLessonsPath = lessonsPath || (await findLessonsPath().catch(() => 'unknown'));
        const filename = lessonMap[lessonId] || 'unknown';
        const attemptedPath = typeof resolvedLessonsPath === 'string' 
          ? join(resolvedLessonsPath, filename)
          : 'unknown';
        console.error('[Docs] File not found:', {
          lessonId,
          lessonsPath: resolvedLessonsPath,
          attemptedPath,
          error: error.message,
        });
        return res.status(404).json({
          success: false,
          error: {
            message: 'Lesson file not found',
            details: `Path: ${attemptedPath}`,
          },
        });
      }

      console.error('[Docs] Error reading lesson:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to fetch lesson',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  });

  return router;
}
