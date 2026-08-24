import { Router } from 'express';
import { MessageController } from '../../controllers/message.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/authorization.middleware';
import { validateRequest } from '../../middleware/validation.middleware';
import { createConversationSchema, sendMessageSchema } from '../../validators/message.validator';
import { PermissionName } from '../../constants/permissions';
import { noCacheMiddleware } from '../../middleware/security.middleware';

const router = Router();

router.use(requireAuth, noCacheMiddleware);

router.post('/conversations', requirePermission(PermissionName.MESSAGE_SEND), validateRequest(createConversationSchema), MessageController.createConversation);
router.get('/conversations', requirePermission(PermissionName.MESSAGE_VIEW), MessageController.listConversations);
router.get('/conversations/:id/messages', requirePermission(PermissionName.MESSAGE_VIEW), MessageController.getMessages);
router.post('/conversations/:id/messages', requirePermission(PermissionName.MESSAGE_SEND), validateRequest(sendMessageSchema), MessageController.sendMessage);

export default router;
