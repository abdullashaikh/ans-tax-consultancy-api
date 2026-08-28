import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import clientRoutes from './client.routes';
import serviceRoutes from './service.routes';
import applicationRoutes from './application.routes';
import documentRoutes from './document.routes';
import leadRoutes from './lead.routes';
import appointmentRoutes from './appointment.routes';
import paymentRoutes from './payment.routes';
import messageRoutes from './message.routes';
import notificationRoutes from './notification.routes';
import cmsRoutes from './cms.routes';
import settingRoutes from './setting.routes';
import auditRoutes from './audit.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/clients', clientRoutes);
router.use('/services', serviceRoutes);
router.use('/applications', applicationRoutes);
router.use('/documents', documentRoutes);
router.use('/leads', leadRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/payments', paymentRoutes);
router.post('/create-order', (req, res, next) => {
  req.url = '/create-order';
  paymentRoutes(req, res, next);
});
router.post('/verify-payment', (req, res, next) => {
  req.url = '/verify-payment';
  paymentRoutes(req, res, next);
});
router.use('/messages', messageRoutes);
router.use('/notifications', notificationRoutes);
router.use('/cms', cmsRoutes);
router.use('/settings', settingRoutes);
router.use('/audit-logs', auditRoutes);

export default router;
