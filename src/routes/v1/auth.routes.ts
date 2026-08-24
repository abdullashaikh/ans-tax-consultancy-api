import { Router } from 'express';
import { AuthController } from '../../controllers/auth.controller';
import { validateRequest } from '../../middleware/validation.middleware';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../../validators/auth.validator';
import { requireAuth } from '../../middleware/auth.middleware';
import { authRateLimiter } from '../../middleware/rateLimit.middleware';
import { noCacheMiddleware } from '../../middleware/security.middleware';

const router = Router();

// Apply no-cache to all authentication routes
router.use(noCacheMiddleware);

router.post('/register', authRateLimiter, validateRequest(registerSchema), AuthController.register);
router.post('/login', authRateLimiter, validateRequest(loginSchema), AuthController.login);
router.post('/refresh', authRateLimiter, validateRequest(refreshTokenSchema), AuthController.refresh);
router.post('/logout', AuthController.logout);
router.post('/forgot-password', authRateLimiter, validateRequest(forgotPasswordSchema), AuthController.forgotPassword);
router.post('/reset-password', authRateLimiter, validateRequest(resetPasswordSchema), AuthController.resetPassword);

router.get('/me', requireAuth, AuthController.getMe);

export default router;
