import { Router } from 'express';
import { ClientController } from '../../controllers/client.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/authorization.middleware';
import { validateRequest } from '../../middleware/validation.middleware';
import { updateClientSchema, addClientAddressSchema } from '../../validators/client.validator';
import { PermissionName } from '../../constants/permissions';
import { noCacheMiddleware } from '../../middleware/security.middleware';

const router = Router();

router.use(requireAuth, noCacheMiddleware);

// Client self-service profile (no admin permission required for own profile)
router.get('/profile', ClientController.getMyProfile);
router.patch('/profile', validateRequest(updateClientSchema), ClientController.updateMyProfile);

// Admin client management
router.get('/', requirePermission(PermissionName.CLIENT_VIEW), ClientController.list);
router.get('/:id', requirePermission(PermissionName.CLIENT_VIEW), ClientController.getById);
router.patch('/:id', requirePermission(PermissionName.CLIENT_UPDATE), validateRequest(updateClientSchema), ClientController.update);
router.post('/:id/addresses', requirePermission(PermissionName.CLIENT_UPDATE), validateRequest(addClientAddressSchema), ClientController.addAddress);

export default router;
