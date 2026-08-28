import { Request, Response, NextFunction } from 'express';
import { AuditQueryService } from '../services/audit.service';
import { ResponseFormatter } from '../utils/apiResponse';
import { PaginationUtil } from '../utils/pagination';

export class AuditController {
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, offset, search } = PaginationUtil.parseQuery(req.query);
      const action = req.query['action'] as string | undefined;
      const entityType = req.query['entityType'] as string | undefined;

      const { logs, total } = await AuditQueryService.listLogs({
        action,
        entityType,
        search,
        limit,
        offset,
      });

      const meta = PaginationUtil.buildMeta(page, limit, total);
      ResponseFormatter.success(res, logs, undefined, 200, meta);
    } catch (error) {
      next(error);
    }
  }

  static async getSuperAdminSummary(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const summary = await AuditQueryService.getSuperAdminSummary();
      ResponseFormatter.success(res, summary);
    } catch (error) {
      next(error);
    }
  }
}
