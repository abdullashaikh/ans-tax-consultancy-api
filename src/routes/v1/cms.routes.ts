import { Router } from 'express';
import { CmsController } from '../../controllers/cms.controller';

const router = Router();

// Public CMS endpoints
router.get('/faqs', CmsController.listFaqs);
router.get('/blog', CmsController.listBlogPosts);
router.get('/blog/:slug', CmsController.getBlogPostBySlug);

export default router;
