import { Router } from 'express';
import { AuditController } from '../../controllers/audit.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/authorization.middleware';
import { PermissionName } from '../../constants/permissions';
import { noCacheMiddleware } from '../../middleware/security.middleware';

const router = Router();

router.use(requireAuth, noCacheMiddleware);

router.get('/', requirePermission(PermissionName.AUDIT_VIEW), AuditController.list);

export default router;
