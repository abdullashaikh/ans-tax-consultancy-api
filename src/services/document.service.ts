import { v4 as uuidv4 } from 'uuid';
import { DocumentRepository } from '../repositories/document.repository';
import { ClientRepository } from '../repositories/client.repository';
import { ApiError } from '../utils/apiError';
import { ErrorCodes } from '../constants/errorCodes';
import { DocumentStatus } from '../types/models';
import { AuditService } from '../middleware/audit.middleware';
import { env } from '../config/env';

export class DocumentService {
  /**
   * Generates a pre-signed URL for secure time-limited document download.
   * (In production, uses AWS S3 / GCS SDK. Here we construct a time-limited tokenized URL).
   */
  static async generateDownloadUrl(docPublicId: string, requestedByUserId: number, ipAddress?: string): Promise<{ downloadUrl: string; expiresAt: Date }> {
    const doc = await DocumentRepository.findByPublicId(docPublicId);
    if (!doc) {
      throw ApiError.notFound('Document not found', ErrorCodes.DOCUMENT_NOT_FOUND);
    }

    const expiresAt = new Date(Date.now() + env.SIGNED_URL_EXPIRY_SECONDS * 1000);
    // In production with S3: getSignedUrl(s3Client, new GetObjectCommand(...), { expiresIn: 900 })
    const downloadUrl = `${env.APP_URL}${env.API_PREFIX}/documents/${doc.public_id}/download-stream?signature=${uuidv4()}&expires=${expiresAt.getTime()}`;

    await AuditService.log({
      userId: requestedByUserId,
      action: 'DOCUMENT_DOWNLOAD_URL_GENERATED',
      entityType: 'DOCUMENT',
      entityId: doc.id,
      ipAddress,
    });

    return { downloadUrl, expiresAt };
  }

  static async registerDocument(params: {
    userId: number;
    applicationId?: number;
    documentTypeId: number;
    originalFileName: string;
    storageProvider?: string;
    storageObjectKey: string;
    mimeType: string;
    fileSize: number;
    checksum?: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const client = await ClientRepository.findByUserId(params.userId);
    if (!client) {
      throw ApiError.badRequest('User does not have an active client profile');
    }

    const publicId = uuidv4();
    const docId = await DocumentRepository.register({
      publicId,
      clientId: client.id,
      applicationId: params.applicationId,
      documentTypeId: params.documentTypeId,
      originalFileName: params.originalFileName,
      storageProvider: params.storageProvider || env.STORAGE_PROVIDER,
      storageObjectKey: params.storageObjectKey,
      mimeType: params.mimeType,
      fileSize: params.fileSize,
      checksum: params.checksum,
      uploadedBy: params.userId,
    });

    await AuditService.log({
      userId: params.userId,
      action: 'DOCUMENT_UPLOADED',
      entityType: 'DOCUMENT',
      entityId: docId,
      newValues: { fileName: params.originalFileName, size: params.fileSize },
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    return DocumentRepository.findByPublicId(publicId);
  }

  static async updateStatus(
    publicId: string,
    status: DocumentStatus,
    performedByUserId: number,
    notes?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const doc = await DocumentRepository.findByPublicId(publicId);
    if (!doc) {
      throw ApiError.notFound('Document not found', ErrorCodes.DOCUMENT_NOT_FOUND);
    }

    await DocumentRepository.updateStatus(doc.id, status);

    await AuditService.log({
      userId: performedByUserId,
      action: status === 'VERIFIED' ? 'DOCUMENT_VERIFIED' : 'DOCUMENT_STATUS_CHANGE',
      entityType: 'DOCUMENT',
      entityId: doc.id,
      oldValues: { status: doc.status },
      newValues: { status, notes },
      ipAddress,
      userAgent,
    });

    return DocumentRepository.findByPublicId(publicId);
  }

  static async listByClient(clientId: number) {
    return DocumentRepository.listByClient(clientId);
  }

  static async listByApplication(applicationId: number) {
    return DocumentRepository.listByApplication(applicationId);
  }

  static async listDocumentTypes() {
    return DocumentRepository.listDocumentTypes();
  }

  static async listDocuments(params: {
    status?: string;
    clientId?: number;
    search?: string;
    limit: number;
    offset: number;
  }) {
    return DocumentRepository.list(params);
  }
}
