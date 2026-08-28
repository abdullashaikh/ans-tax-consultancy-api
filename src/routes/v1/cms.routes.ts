import { Router } from 'express';
import { CmsController } from '../../controllers/cms.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/authorization.middleware';
import { RoleName } from '../../constants/roles';
import { noCacheMiddleware } from '../../middleware/security.middleware';

const router = Router();

// ============================================================================
// Public CMS Endpoints
// ============================================================================
router.get('/content', CmsController.getPublicContent);
router.get('/faqs', CmsController.listFaqs);
router.get('/blog', CmsController.listBlogPosts);
router.get('/blog/:slug', CmsController.getBlogPostBySlug);

// ============================================================================
// Super Admin CMS Management Endpoints (Requires SUPER_ADMIN role)
// ============================================================================
const superAdminAuth = [requireAuth, noCacheMiddleware, requireRole(RoleName.SUPER_ADMIN)];

router.get('/content/all', ...superAdminAuth, CmsController.getAllContent);
router.put('/content', ...superAdminAuth, CmsController.updateContentBatch);

export default router;
