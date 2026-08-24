import { Request, Response, NextFunction } from 'express';
import { DocumentService } from '../services/document.service';
import { ResponseFormatter } from '../utils/apiResponse';
import { PaginationUtil } from '../utils/pagination';
import { ObjectAuth } from '../middleware/objectAuth.middleware';
import { AuditService } from '../middleware/audit.middleware';

export class DocumentController {
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, offset, search } = PaginationUtil.parseQuery(req.query);
      const status = req.query['status'] as string | undefined;
      const clientId = req.query['clientId'] ? parseInt(req.query['clientId'] as string, 10) : undefined;

      const { documents, total } = await DocumentService.listDocuments({
        status,
        clientId,
        search,
        limit,
        offset,
      });

      const meta = PaginationUtil.buildMeta(page, limit, total);
      ResponseFormatter.success(res, documents, undefined, 200, meta);
    } catch (error) {
      next(error);
    }
  }
  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ipAddress = AuditService.getClientIp(req);
      const userAgent = req.headers['user-agent'];

      const document = await DocumentService.registerDocument({
        userId: req.user!.id,
        ...req.body,
        ipAddress,
        userAgent,
      });

      ResponseFormatter.created(res, document, 'Document registered successfully');
    } catch (error) {
      next(error);
    }
  }

  static async getDownloadUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const docPublicId = req.params['id']!;
      const ipAddress = AuditService.getClientIp(req);

      // IDOR protection: verifies caller has ownership or assignment
      await ObjectAuth.checkDocumentAccess(req, docPublicId);

      const downloadInfo = await DocumentService.generateDownloadUrl(docPublicId, req.user!.id, ipAddress);
      ResponseFormatter.success(res, downloadInfo);
    } catch (error) {
      next(error);
    }
  }

  static async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const docPublicId = req.params['id']!;
      const ipAddress = AuditService.getClientIp(req);
      const userAgent = req.headers['user-agent'];

      const document = await DocumentService.updateStatus(
        docPublicId,
        req.body.status,
        req.user!.id,
        req.body.notes,
        ipAddress,
        userAgent
      );

      ResponseFormatter.success(res, document, 'Document status updated successfully');
    } catch (error) {
      next(error);
    }
  }

  static async listDocumentTypes(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const types = await DocumentService.listDocumentTypes();
      ResponseFormatter.success(res, types);
    } catch (error) {
      next(error);
    }
  }

  static async listByApplication(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const appPublicId = req.params['appId']!;
      const { appId } = await ObjectAuth.checkApplicationAccess(req, appPublicId);
      const docs = await DocumentService.listByApplication(appId);
      ResponseFormatter.success(res, docs);
    } catch (error) {
      next(error);
    }
  }
}
