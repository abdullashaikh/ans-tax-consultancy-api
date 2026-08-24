import { Router } from 'express';
import { ServiceController } from '../../controllers/service.controller';

const router = Router();

// Public catalogue routes
router.get('/categories', ServiceController.listCategories);
router.get('/categories/:slug', ServiceController.getCategoryBySlug);
router.get('/', ServiceController.listServices);
router.get('/:slug', ServiceController.getServiceBySlug);

export default router;
