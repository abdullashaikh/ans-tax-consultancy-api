import { Router } from 'express';
import { UserController } from '../../controllers/user.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission, requireRole } from '../../middleware/authorization.middleware';
import { validateRequest } from '../../middleware/validation.middleware';
import {
  updateUserSchema,
  createStaffUserSchema,
  adminUpdateUserSchema,
  listUsersSchema,
} from '../../validators/user.validator';
import { changePasswordSchema } from '../../validators/auth.validator';
import { RoleName } from '../../constants/roles';
import { PermissionName } from '../../constants/permissions';
import { noCacheMiddleware } from '../../middleware/security.middleware';

const router = Router();

router.use(requireAuth, noCacheMiddleware);

// Current user operations
router.patch('/profile', validateRequest(updateUserSchema), UserController.updateProfile);
router.post('/change-password', validateRequest(changePasswordSchema), UserController.changePassword);

// Administrative user operations
router.get('/', requirePermission(PermissionName.USER_VIEW), validateRequest(listUsersSchema), UserController.list);
router.post('/', requireRole(RoleName.SUPER_ADMIN), validateRequest(createStaffUserSchema), UserController.createStaff);
router.get('/:id', requirePermission(PermissionName.USER_VIEW), UserController.getById);
router.patch('/:id', requireRole(RoleName.ADMIN, RoleName.SUPER_ADMIN), validateRequest(adminUpdateUserSchema), UserController.adminUpdate);

export default router;
