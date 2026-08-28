import { Router } from 'express';
import { AuditController } from '../../controllers/audit.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission, requireRole } from '../../middleware/authorization.middleware';
import { PermissionName } from '../../constants/permissions';
import { RoleName } from '../../constants/roles';
import { noCacheMiddleware } from '../../middleware/security.middleware';

const router = Router();

router.use(requireAuth, noCacheMiddleware);

router.get('/super-admin-summary', requireRole(RoleName.SUPER_ADMIN), AuditController.getSuperAdminSummary);
router.get('/', requirePermission(PermissionName.AUDIT_VIEW), AuditController.list);

export default router;
