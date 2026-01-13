import { Router, Request, Response } from 'express';

/**
 * Health check route
 * 
 * Always available, even if model is not loaded.
 * Used for monitoring and load balancer health checks.
 */
export function createHealthRouter(): Router {
  const router = Router();

  /**
   * @swagger
   * /health:
   *   get:
   *     summary: Health check endpoint
   *     description: Returns the health status of the service. Always available, even if model is not loaded.
   *     tags: [Health]
   *     responses:
   *       200:
   *         description: Service is healthy
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/HealthResponse'
   */
  router.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'communication-mirror-backend',
    });
  });

  return router;
}
