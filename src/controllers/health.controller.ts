import { Request, Response } from 'express';
import { checkDatabaseHealth } from '../config/database';
import { ResponseFormatter } from '../utils/apiResponse';
import { HttpStatus } from '../constants/httpStatus';
import { env } from '../config/env';

export class HealthController {
  static getHealth(_req: Request, res: Response): void {
    ResponseFormatter.success(res, {
      status: 'UP',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      service: env.APP_NAME,
      version: env.API_VERSION,
    });
  }

  static async getReady(_req: Request, res: Response): Promise<void> {
    const isDbHealthy = await checkDatabaseHealth();

    if (isDbHealthy) {
      ResponseFormatter.success(res, {
        status: 'READY',
        database: 'CONNECTED',
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        success: false,
        status: 'NOT_READY',
        database: 'DISCONNECTED',
        timestamp: new Date().toISOString(),
      });
    }
  }
}
