import { Request, Response, NextFunction } from 'express';
import { DocumentService } from '../services/document.service';
import { ResponseFormatter } from '../utils/apiResponse';
import { PaginationUtil } from '../utils/pagination';
import { ObjectAuth } from '../middleware/objectAuth.middleware';
import { AuditService } from '../middleware/audit.middleware';
import { ApiError } from '../utils/apiError';
import { RoleName } from '../constants/roles';
import { ClientRepository } from '../repositories/client.repository';

export class DocumentController {
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, offset, search } = PaginationUtil.parseQuery(req.query);
      const status = req.query['status'] as string | undefined;
      const user = req.user!;

      // Scope to authenticated client's own documents
      let clientId: number | undefined;
      const isClient = user.roles.includes(RoleName.CLIENT) || !user.roles.some(r => [RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.CONSULTANT, RoleName.STAFF].includes(r));

      if (isClient) {
        clientId = user.clientId;
        if (!clientId) {
          const clientRecord = await ClientRepository.findByUserId(user.id);
          clientId = clientRecord?.id;
        }
        if (!clientId) {
          // Client has no profile or documents yet; safely return empty list
          const meta = PaginationUtil.buildMeta(page, limit, 0);
          ResponseFormatter.success(res, [], undefined, 200, meta);
          return;
        }
      } else {
        clientId = req.query['clientId'] ? parseInt(req.query['clientId'] as string, 10) : undefined;
      }

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

  /**
   * Returns all documents belonging to the authenticated client user.
   */
  static async listMyDocuments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const documents = await DocumentService.listMyDocuments(req.user!.id);
      ResponseFormatter.success(res, documents);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Generates a pre-signed AWS S3 upload URL for direct browser PUT upload.
   */
  static async getUploadUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await DocumentService.generateUploadUrl({
        userId: req.user!.id,
        applicationId: req.body.applicationId,
        documentTypeId: req.body.documentTypeId,
        originalFileName: req.body.originalFileName,
        mimeType: req.body.mimeType,
        fileSize: req.body.fileSize,
      });

      ResponseFormatter.success(res, result, 'Pre-signed upload URL generated successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Direct file upload via multipart/form-data with buffer streaming to S3.
   */
  static async uploadDirect(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw ApiError.badRequest('No document file was uploaded.');
      }

      const ipAddress = AuditService.getClientIp(req);
      const userAgent = req.headers['user-agent'];
      const documentTypeId = parseInt(req.body.documentTypeId, 10);
      const applicationId = req.body.applicationId ? parseInt(req.body.applicationId, 10) : undefined;

      if (!documentTypeId || isNaN(documentTypeId)) {
        throw ApiError.badRequest('Valid documentTypeId is required.');
      }

      const document = await DocumentService.uploadDirect({
        userId: req.user!.id,
        file: req.file,
        applicationId,
        documentTypeId,
        ipAddress,
        userAgent,
      });

      ResponseFormatter.created(res, document, 'Document uploaded and registered successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Registers document metadata after pre-signed S3 upload.
   */
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

  /**
   * Generates a pre-signed AWS S3 download/viewing URL.
   */
  static async getDownloadUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const docPublicId = req.params['id']!;
      const ipAddress = AuditService.getClientIp(req);
      const disposition = req.query['disposition'] === 'inline' ? 'inline' : 'attachment';

      // IDOR protection: verifies caller has ownership or assignment
      await ObjectAuth.checkDocumentAccess(req, docPublicId);

      const downloadInfo = await DocumentService.generateDownloadUrl(
        docPublicId,
        req.user!.id,
        ipAddress,
        disposition
      );
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
