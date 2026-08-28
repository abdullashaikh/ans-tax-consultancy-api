import { Router } from 'express';
import { PaymentController } from '../../controllers/payment.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/authorization.middleware';
import { validateRequest } from '../../middleware/validation.middleware';
import {
  createPaymentSchema,
  createOrderSchema,
  verifyPaymentSchema,
  paymentWebhookSchema,
} from '../../validators/payment.validator';
import { PermissionName } from '../../constants/permissions';
import { noCacheMiddleware } from '../../middleware/security.middleware';

const router = Router();

// Webhook endpoint (authenticated via HMAC signature, not JWT)
router.post('/webhook', validateRequest(paymentWebhookSchema), PaymentController.handleWebhook);

// Authenticated payment endpoints
router.use(requireAuth, noCacheMiddleware);

// Razorpay Standard Checkout Endpoints
router.post('/create-order', validateRequest(createOrderSchema), PaymentController.createOrder);
router.post('/orders', validateRequest(createOrderSchema), PaymentController.createOrder);
router.post('/verify-payment', validateRequest(verifyPaymentSchema), PaymentController.verifyPayment);
router.post('/verify', validateRequest(verifyPaymentSchema), PaymentController.verifyPayment);

// Payment Management Endpoints
router.post('/', requirePermission(PermissionName.PAYMENT_MANAGE), validateRequest(createPaymentSchema), PaymentController.create);
router.get('/', requirePermission(PermissionName.PAYMENT_VIEW), PaymentController.list);

export default router;
