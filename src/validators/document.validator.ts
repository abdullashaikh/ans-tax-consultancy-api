import { z } from 'zod';

export const registerDocumentSchema = {
  body: z.object({
    applicationId: z.number().int().positive().optional(),
    documentTypeId: z.number().int().positive('Document type ID is required'),
    originalFileName: z.string().min(1).max(255),
    storageProvider: z.string().default('S3'),
    storageObjectKey: z.string().min(1).max(500),
    mimeType: z.enum([
      'application/pdf',
      'image/jpeg',
      'image/png',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/zip',
    ]),
    fileSize: z.number().int().positive().max(25 * 1024 * 1024, 'File size exceeds maximum limit of 25MB'),
    checksum: z.string().max(64).optional(),
  }),
};

export const updateDocumentStatusSchema = {
  params: z.object({
    id: z.string().uuid('Invalid document UUID'),
  }),
  body: z.object({
    status: z.enum(['UPLOADED', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'EXPIRED']),
    notes: z.string().optional(),
  }),
};
