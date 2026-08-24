import { Router } from 'express';
import { NotificationController } from '../../controllers/notification.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { noCacheMiddleware } from '../../middleware/security.middleware';

const router = Router();

router.use(requireAuth, noCacheMiddleware);

router.get('/unread', NotificationController.getUnread);
router.patch('/:id/read', NotificationController.markRead);
router.patch('/read-all', NotificationController.markAllRead);

export default router;
