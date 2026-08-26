import { Router } from 'express';
import { DocumentController } from '../../controllers/document.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/authorization.middleware';
import { validateRequest } from '../../middleware/validation.middleware';
import { uploadMiddleware } from '../../middleware/upload.middleware';
import {
  getUploadUrlSchema,
  registerDocumentSchema,
  updateDocumentStatusSchema,
} from '../../validators/document.validator';
import { PermissionName } from '../../constants/permissions';
import { uploadRateLimiter } from '../../middleware/rateLimit.middleware';
import { noCacheMiddleware } from '../../middleware/security.middleware';

const router = Router();

router.use(requireAuth, noCacheMiddleware);

// Document type catalogue (public to all authenticated users)
router.get('/types', DocumentController.listDocumentTypes);

// Client self-service documents list
router.get('/my-documents', DocumentController.listMyDocuments);

// Admin list documents with pagination
router.get('/', requirePermission(PermissionName.DOCUMENT_VIEW), DocumentController.list);

// 1. Pre-signed S3 Upload URL Generator (Direct Browser -> AWS S3 upload)
router.post(
  '/upload-url',
  uploadRateLimiter,
  validateRequest(getUploadUrlSchema),
  DocumentController.getUploadUrl
);

// 2. Direct File Upload (Multipart Form Data -> Backend Streams to AWS S3)
router.post(
  '/upload',
  uploadRateLimiter,
  uploadMiddleware.single('file'),
  DocumentController.uploadDirect
);

// 3. Register Document Metadata (after client direct S3 PUT upload)
router.post(
  '/',
  uploadRateLimiter,
  validateRequest(registerDocumentSchema),
  DocumentController.register
);

// 4. Pre-signed S3 Download URL Generator (Access protected via ObjectAuth in controller)
router.get(
  '/:id/download-url',
  DocumentController.getDownloadUrl
);

// 5. Verification status updates (staff only)
router.patch(
  '/:id/status',
  requirePermission(PermissionName.DOCUMENT_VERIFY),
  validateRequest(updateDocumentStatusSchema),
  DocumentController.updateStatus
);

// 6. List by Application (Access protected via ObjectAuth in controller)
router.get(
  '/by-application/:appId',
  DocumentController.listByApplication
);

export default router;
