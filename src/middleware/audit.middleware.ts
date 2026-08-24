import { Request } from 'express';
import { pool } from '../config/database';
import { logger } from '../config/logger';

export class AuditService {
  /**
   * Records an immutable audit log entry into the MySQL audit_logs table.
   */
  static async log(params: {
    userId?: number | null;
    action: string;
    entityType: string;
    entityId?: number | null;
    oldValues?: Record<string, any> | null;
    newValues?: Record<string, any> | null;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          params.userId || null,
          params.action,
          params.entityType,
          params.entityId || null,
          params.oldValues ? JSON.stringify(params.oldValues) : null,
          params.newValues ? JSON.stringify(params.newValues) : null,
          params.ipAddress || null,
          params.userAgent ? params.userAgent.substring(0, 500) : null,
        ]
      );
    } catch (error) {
      // Non-blocking: never crash an ongoing request if audit log insert fails, but log error
      logger.error('Failed to persist audit log entry:', { error, action: params.action });
    }
  }

  /**
   * Helper to extract client IP from express request.
   */
  static getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
    }
    return req.socket.remoteAddress || 'unknown';
  }
}
