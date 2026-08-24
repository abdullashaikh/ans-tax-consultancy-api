import { Request, Response, NextFunction } from 'express';
import { LeadService } from '../services/lead.service';
import { ResponseFormatter } from '../utils/apiResponse';
import { PaginationUtil } from '../utils/pagination';
import { AuditService } from '../middleware/audit.middleware';

export class LeadController {
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ipAddress = AuditService.getClientIp(req);
      const userAgent = req.headers['user-agent'];

      const lead = await LeadService.createLead({
        ...req.body,
        ipAddress,
        userAgent,
      });

      ResponseFormatter.created(res, lead, 'Inquiry received. A representative will contact you shortly.');
    } catch (error) {
      next(error);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, offset, search } = PaginationUtil.parseQuery(req.query);
      const status = req.query['status'] as string | undefined;
      const assignedTo = req.query['assignedTo'] ? parseInt(req.query['assignedTo'] as string, 10) : undefined;

      const { leads, total } = await LeadService.listLeads({ status, assignedTo, search, limit, offset });
      const meta = PaginationUtil.buildMeta(page, limit, total);

      ResponseFormatter.success(res, leads, undefined, 200, meta);
    } catch (error) {
      next(error);
    }
  }

  static async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const lead = await LeadService.updateStatus(
        req.params['id']!,
        req.body.status,
        req.body.assignedTo,
        req.user?.id
      );
      ResponseFormatter.success(res, lead, 'Lead status updated successfully');
    } catch (error) {
      next(error);
    }
  }

  static async convertToClient(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await LeadService.convertLeadToClient(req.params['id']!, req.body, req.user!.id);
      ResponseFormatter.success(res, user, 'Lead converted to client account successfully');
    } catch (error) {
      next(error);
    }
  }
}
