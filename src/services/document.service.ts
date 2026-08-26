import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { DocumentRepository } from '../repositories/document.repository';
import { ClientRepository } from '../repositories/client.repository';
import { S3StorageService } from './storage/s3StorageService';
import { ApiError } from '../utils/apiError';
import { ErrorCodes } from '../constants/errorCodes';
import { DocumentStatus } from '../types/models';
import { AuditService } from '../middleware/audit.middleware';
import { env } from '../config/env';

export class DocumentService {
  /**
   * Generates a pre-signed S3 URL for secure direct browser-to-S3 document upload.
   */
  static async generateUploadUrl(params: {
    userId: number;
    applicationId?: number;
    documentTypeId: number;
    originalFileName: string;
    mimeType: string;
    fileSize: number;
  }): Promise<{
    uploadUrl: string;
    storageObjectKey: string;
    storageProvider: string;
    publicId: string;
    expiresIn: number;
  }> {
    const client = await ClientRepository.findByUserId(params.userId);
    if (!client) {
      throw ApiError.badRequest('User does not have an active client profile');
    }

    const publicId = uuidv4();
    const sanitizedFileName = params.originalFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const folder = params.applicationId ? `applications/app_${params.applicationId}` : 'general';
    const storageObjectKey = `clients/client_${client.id}/${folder}/${publicId}_${sanitizedFileName}`;

    const { uploadUrl, expiresIn } = await S3StorageService.generatePresignedUploadUrl({
      key: storageObjectKey,
      contentType: params.mimeType,
      expiresInSeconds: env.SIGNED_URL_EXPIRY_SECONDS || 900,
    });

    return {
      uploadUrl,
      storageObjectKey,
      storageProvider: 'S3',
      publicId,
      expiresIn,
    };
  }

  /**
   * Generates a pre-signed S3 URL for secure time-limited document download/viewing.
   */
  static async generateDownloadUrl(
    docPublicId: string,
    requestedByUserId: number,
    ipAddress?: string,
    disposition: 'attachment' | 'inline' = 'attachment'
  ): Promise<{ downloadUrl: string; expiresAt: Date; fileName: string; mimeType: string }> {
    const doc = await DocumentRepository.findByPublicId(docPublicId);
    if (!doc) {
      throw ApiError.notFound('Document not found', ErrorCodes.DOCUMENT_NOT_FOUND);
    }

    const { downloadUrl, expiresAt } = await S3StorageService.generatePresignedDownloadUrl({
      key: doc.storage_object_key,
      originalFileName: doc.original_file_name,
      expiresInSeconds: env.SIGNED_URL_EXPIRY_SECONDS || 900,
      disposition,
    });

    await AuditService.log({
      userId: requestedByUserId,
      action: 'DOCUMENT_DOWNLOAD_URL_GENERATED',
      entityType: 'DOCUMENT',
      entityId: doc.id,
      ipAddress,
    });

    return {
      downloadUrl,
      expiresAt,
      fileName: doc.original_file_name,
      mimeType: doc.mime_type,
    };
  }

  /**
   * Handles direct file upload via multipart/form-data:
   * 1. Computes SHA-256 checksum
   * 2. Uploads buffer directly to AWS S3 bucket
   * 3. Records document metadata in MySQL database
   * 4. Logs audit trail
   */
  static async uploadDirect(params: {
    userId: number;
    file: Express.Multer.File;
    applicationId?: number;
    documentTypeId: number;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const client = await ClientRepository.findByUserId(params.userId);
    if (!client) {
      throw ApiError.badRequest('User does not have an active client profile');
    }

    const publicId = uuidv4();
    const sanitizedFileName = params.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const folder = params.applicationId ? `applications/app_${params.applicationId}` : 'general';
    const storageObjectKey = `clients/client_${client.id}/${folder}/${publicId}_${sanitizedFileName}`;

    // 1. Calculate SHA-256 checksum
    const checksum = crypto.createHash('sha256').update(params.file.buffer).digest('hex');

    // 2. Upload to AWS S3
    await S3StorageService.uploadBuffer({
      key: storageObjectKey,
      buffer: params.file.buffer,
      contentType: params.file.mimetype,
    });

    // 3. Register document in database
    const docId = await DocumentRepository.register({
      publicId,
      clientId: client.id,
      applicationId: params.applicationId,
      documentTypeId: params.documentTypeId,
      originalFileName: params.file.originalname,
      storageProvider: 'S3',
      storageObjectKey,
      mimeType: params.file.mimetype,
      fileSize: params.file.size,
      checksum,
      uploadedBy: params.userId,
    });

    // 4. Audit trail
    await AuditService.log({
      userId: params.userId,
      action: 'DOCUMENT_UPLOADED',
      entityType: 'DOCUMENT',
      entityId: docId,
      newValues: {
        fileName: params.file.originalname,
        size: params.file.size,
        mimeType: params.file.mimetype,
        storageKey: storageObjectKey,
      },
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    return DocumentRepository.findByPublicId(publicId);
  }

  /**
   * Registers document metadata after direct client-to-S3 upload.
   */
  static async registerDocument(params: {
    userId: number;
    publicId?: string;
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

    const publicId = params.publicId || uuidv4();
    const docId = await DocumentRepository.register({
      publicId,
      clientId: client.id,
      applicationId: params.applicationId,
      documentTypeId: params.documentTypeId,
      originalFileName: params.originalFileName,
      storageProvider: params.storageProvider || env.STORAGE_PROVIDER || 'S3',
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

  static async listMyDocuments(userId: number) {
    const client = await ClientRepository.findByUserId(userId);
    if (!client) {
      return [];
    }
    return DocumentRepository.listByClient(client.id);
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
