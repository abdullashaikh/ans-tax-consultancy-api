import { Router } from 'express';
import { ApplicationController } from '../../controllers/application.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/authorization.middleware';
import { validateRequest } from '../../middleware/validation.middleware';
import {
  createApplicationSchema,
  updateApplicationStatusSchema,
  assignConsultantSchema,
  listApplicationsSchema,
} from '../../validators/application.validator';
import { PermissionName } from '../../constants/permissions';
import { noCacheMiddleware } from '../../middleware/security.middleware';

const router = Router();

router.use(requireAuth, noCacheMiddleware);

router.post('/', requirePermission(PermissionName.APPLICATION_CREATE), validateRequest(createApplicationSchema), ApplicationController.create);
router.get('/', requirePermission(PermissionName.APPLICATION_VIEW), validateRequest(listApplicationsSchema), ApplicationController.list);
router.get('/:id', requirePermission(PermissionName.APPLICATION_VIEW), ApplicationController.getById);
router.patch('/:id/status', requirePermission(PermissionName.APPLICATION_UPDATE), validateRequest(updateApplicationStatusSchema), ApplicationController.updateStatus);
router.post('/:id/assign', requirePermission(PermissionName.APPLICATION_UPDATE), validateRequest(assignConsultantSchema), ApplicationController.assignConsultant);

export default router;
