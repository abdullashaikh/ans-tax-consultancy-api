import { Router } from 'express';
import { LeadController } from '../../controllers/lead.controller';
import { validateRequest } from '../../middleware/validation.middleware';
import { createLeadSchema, updateLeadStatusSchema, convertLeadSchema } from '../../validators/lead.validator';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/authorization.middleware';
import { leadRateLimiter } from '../../middleware/rateLimit.middleware';
import { PermissionName } from '../../constants/permissions';
import { noCacheMiddleware } from '../../middleware/security.middleware';

const router = Router();

// Public lead submission with rate limiting
router.post('/', leadRateLimiter, validateRequest(createLeadSchema), LeadController.create);

// Internal CRM routes
router.get('/', requireAuth, noCacheMiddleware, requirePermission(PermissionName.CLIENT_VIEW), LeadController.list);
router.patch('/:id/status', requireAuth, noCacheMiddleware, requirePermission(PermissionName.CLIENT_UPDATE), validateRequest(updateLeadStatusSchema), LeadController.updateStatus);
router.post('/:id/convert', requireAuth, noCacheMiddleware, requirePermission(PermissionName.CLIENT_CREATE), validateRequest(convertLeadSchema), LeadController.convertToClient);

export default router;
