import { Router } from 'express';
import { AppointmentController } from '../../controllers/appointment.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/authorization.middleware';
import { validateRequest } from '../../middleware/validation.middleware';
import { createAppointmentSchema, updateAppointmentStatusSchema } from '../../validators/appointment.validator';
import { PermissionName } from '../../constants/permissions';
import { noCacheMiddleware } from '../../middleware/security.middleware';

const router = Router();

router.use(requireAuth, noCacheMiddleware);

router.post('/', requirePermission(PermissionName.APPOINTMENT_MANAGE), validateRequest(createAppointmentSchema), AppointmentController.create);
router.get('/', requirePermission(PermissionName.APPOINTMENT_VIEW), AppointmentController.list);
router.patch('/:id/status', requirePermission(PermissionName.APPOINTMENT_MANAGE), validateRequest(updateAppointmentStatusSchema), AppointmentController.updateStatus);

export default router;
