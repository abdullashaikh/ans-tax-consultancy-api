import { Router } from 'express';
import { SitemapController } from '../controllers/sitemap.controller';

const router = Router();

// Technical SEO & Sitemaps
router.get('/robots.txt', SitemapController.getRobotsTxt);
router.get('/sitemap.xml', SitemapController.getSitemapIndex);
router.get('/service-sitemap.xml', SitemapController.getServiceSitemap);
router.get('/resource-sitemap.xml', SitemapController.getResourceSitemap);
router.get('/location-sitemap.xml', SitemapController.getLocationSitemap);

export default router;
