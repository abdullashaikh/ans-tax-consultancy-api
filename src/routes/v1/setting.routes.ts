import { Router } from 'express';
import { SettingController } from '../../controllers/setting.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/authorization.middleware';
import { validateRequest } from '../../middleware/validation.middleware';
import { setSettingSchema } from '../../validators/setting.validator';
import { RoleName } from '../../constants/roles';

const router = Router();

// Public settings for frontend consumption
router.get('/public', SettingController.listPublic);

// Admin-managed settings
router.get('/:key', requireAuth, requireRole(RoleName.ADMIN, RoleName.SUPER_ADMIN), SettingController.getByKey);
router.post('/', requireAuth, requireRole(RoleName.ADMIN, RoleName.SUPER_ADMIN), validateRequest(setSettingSchema), SettingController.update);

export default router;
