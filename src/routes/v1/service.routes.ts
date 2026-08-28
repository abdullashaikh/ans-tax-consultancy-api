import { Router } from 'express';
import { ServiceController } from '../../controllers/service.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/authorization.middleware';
import { validateRequest } from '../../middleware/validation.middleware';
import {
  createCategorySchema,
  updateCategorySchema,
  createServiceSchema,
  updateServiceSchema,
  updateServicePricingSchema,
  toggleStatusSchema,
} from '../../validators/service.validator';
import { RoleName } from '../../constants/roles';
import { noCacheMiddleware } from '../../middleware/security.middleware';

const router = Router();

// ============================================================================
// Public Catalogue Endpoints
// ============================================================================
router.get('/categories', ServiceController.listCategories);
router.get('/categories/:slug', ServiceController.getCategoryBySlug);
router.get('/', ServiceController.listServices);
router.get('/:slug', ServiceController.getServiceBySlug);

// ============================================================================
// Super Admin Business Governance Endpoints (Requires SUPER_ADMIN role)
// ============================================================================
const superAdminAuth = [requireAuth, noCacheMiddleware, requireRole(RoleName.SUPER_ADMIN)];

// Category Management
router.post(
  '/categories',
  ...superAdminAuth,
  validateRequest(createCategorySchema),
  ServiceController.createCategory
);
router.put(
  '/categories/:id',
  ...superAdminAuth,
  validateRequest(updateCategorySchema),
  ServiceController.updateCategory
);
router.patch(
  '/categories/:id/status',
  ...superAdminAuth,
  validateRequest(toggleStatusSchema),
  ServiceController.toggleCategoryStatus
);
router.delete(
  '/categories/:id',
  ...superAdminAuth,
  ServiceController.deleteCategory
);

// Service Management
router.post(
  '/',
  ...superAdminAuth,
  validateRequest(createServiceSchema),
  ServiceController.createService
);
router.put(
  '/:id',
  ...superAdminAuth,
  validateRequest(updateServiceSchema),
  ServiceController.updateService
);
router.patch(
  '/:id/status',
  ...superAdminAuth,
  validateRequest(toggleStatusSchema),
  ServiceController.toggleServiceStatus
);
router.patch(
  '/:id/pricing',
  ...superAdminAuth,
  validateRequest(updateServicePricingSchema),
  ServiceController.updatePricing
);
router.get(
  '/:id/price-history',
  ...superAdminAuth,
  ServiceController.getPriceHistory
);
router.delete(
  '/:id',
  ...superAdminAuth,
  ServiceController.deleteService
);

export default router;
