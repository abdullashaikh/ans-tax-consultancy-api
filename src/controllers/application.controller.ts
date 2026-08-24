import { Request, Response, NextFunction } from 'express';
import { ApplicationService } from '../services/application.service';
import { ResponseFormatter } from '../utils/apiResponse';
import { PaginationUtil } from '../utils/pagination';
import { ObjectAuth } from '../middleware/objectAuth.middleware';
import { AuditService } from '../middleware/audit.middleware';
import { RoleName } from '../constants/roles';

export class ApplicationController {
  static async trackByNumber(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refNumber = req.params['refNumber']!;
      const trackingData = await ApplicationService.trackByNumber(refNumber);
      ResponseFormatter.success(res, trackingData, 'Tracking information retrieved');
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ipAddress = AuditService.getClientIp(req);
      const userAgent = req.headers['user-agent'];

      const application = await ApplicationService.createApplication({
        userId: req.user!.id,
        serviceId: req.body.serviceId,
        title: req.body.title,
        description: req.body.description || req.body.notes,
        notes: req.body.notes,
        financialYear: req.body.financialYear,
        assessmentYear: req.body.assessmentYear,
        priority: req.body.priority,
        ipAddress,
        userAgent,
      });

      ResponseFormatter.created(res, application, 'Application created successfully');
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const appPublicId = req.params['id']!;
      // IDOR protection: verifies caller has ownership or assignment
      await ObjectAuth.checkApplicationAccess(req, appPublicId);

      const application = await ApplicationService.getApplicationByPublicId(appPublicId);
      ResponseFormatter.success(res, application);
    } catch (error) {
      next(error);
    }
  }

  static async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const appPublicId = req.params['id']!;
      const ipAddress = AuditService.getClientIp(req);
      const userAgent = req.headers['user-agent'];

      const application = await ApplicationService.updateStatus(
        appPublicId,
        req.body.status,
        req.user!.id,
        req.body.reason,
        ipAddress,
        userAgent
      );

      ResponseFormatter.success(res, application, 'Application status updated successfully');
    } catch (error) {
      next(error);
    }
  }

  static async assignConsultant(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const appPublicId = req.params['id']!;
      const ipAddress = AuditService.getClientIp(req);
      const userAgent = req.headers['user-agent'];

      const application = await ApplicationService.assignConsultant(
        appPublicId,
        req.body.consultantId,
        req.user!.id,
        req.body.notes,
        ipAddress,
        userAgent
      );

      ResponseFormatter.success(res, application, 'Consultant assigned successfully');
    } catch (error) {
      next(error);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, offset, search } = PaginationUtil.parseQuery(req.query);
      const user = req.user!;

      // Scope query based on role
      let clientId: number | undefined;
      let consultantId: number | undefined;

      if (user.roles.includes(RoleName.CLIENT)) {
        clientId = user.clientId;
      } else if (user.roles.includes(RoleName.CONSULTANT) && !user.roles.includes(RoleName.ADMIN) && !user.roles.includes(RoleName.SUPER_ADMIN)) {
        consultantId = user.id;
      }

      const { applications, total } = await ApplicationService.listApplications({
        clientId,
        consultantId,
        status: req.query['status'] as string | undefined,
        priority: req.query['priority'] as string | undefined,
        serviceId: req.query['serviceId'] ? parseInt(req.query['serviceId'] as string, 10) : undefined,
        search,
        limit,
        offset,
      });

      const meta = PaginationUtil.buildMeta(page, limit, total);
      ResponseFormatter.success(res, applications, undefined, 200, meta);
    } catch (error) {
      next(error);
    }
  }
}
