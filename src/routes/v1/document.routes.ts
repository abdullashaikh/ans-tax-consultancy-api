import { Router } from 'express';
import { DocumentController } from '../../controllers/document.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/authorization.middleware';
import { validateRequest } from '../../middleware/validation.middleware';
import {
  registerDocumentSchema,
  updateDocumentStatusSchema,
} from '../../validators/document.validator';
import { PermissionName } from '../../constants/permissions';
import { uploadRateLimiter } from '../../middleware/rateLimit.middleware';
import { noCacheMiddleware } from '../../middleware/security.middleware';

const router = Router();

router.use(requireAuth, noCacheMiddleware);

router.get('/types', DocumentController.listDocumentTypes);
router.get('/', requirePermission(PermissionName.DOCUMENT_VIEW), DocumentController.list);
router.post('/', uploadRateLimiter, requirePermission(PermissionName.DOCUMENT_UPLOAD), validateRequest(registerDocumentSchema), DocumentController.register);
router.get('/:id/download-url', requirePermission(PermissionName.DOCUMENT_VIEW), DocumentController.getDownloadUrl);
router.patch('/:id/status', requirePermission(PermissionName.DOCUMENT_VERIFY), validateRequest(updateDocumentStatusSchema), DocumentController.updateStatus);
router.get('/by-application/:appId', requirePermission(PermissionName.DOCUMENT_VIEW), DocumentController.listByApplication);

export default router;
