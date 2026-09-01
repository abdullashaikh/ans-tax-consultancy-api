import { Request, Response } from 'express';
import { ServiceRepository } from '../repositories/service.repository';

const BASE_URL = process.env.PUBLIC_WEBSITE_URL || 'https://www.anstaxconsultancy.com';

export class SitemapController {
  /**
   * Serves technical robots.txt
   */
  static getRobotsTxt(_req: Request, res: Response): void {
    const robots = [
      'User-agent: *',
      'Allow: /',
      'Allow: /services',
      'Allow: /services/',
      'Allow: /india',
      'Allow: /india/',
      'Allow: /uae',
      'Allow: /uae/',
      'Allow: /about',
      'Allow: /contact',
      'Allow: /calculator',
      'Allow: /track',
      '',
      '# Private Portal & Administrative areas (strictly non-indexed)',
      'Disallow: /admin',
      'Disallow: /admin/',
      'Disallow: /portal',
      'Disallow: /portal/',
      'Disallow: /login',
      'Disallow: /client-portal',
      'Disallow: /api',
      'Disallow: /api/',
      '',
      `Sitemap: ${BASE_URL}/sitemap.xml`,
      `Sitemap: ${BASE_URL}/service-sitemap.xml`,
      `Sitemap: ${BASE_URL}/resource-sitemap.xml`,
      '',
    ].join('\n');

    res.header('Content-Type', 'text/plain; charset=utf-8');
    res.send(robots);
  }

  /**
   * Serves master sitemap index (/sitemap.xml)
   */
  static getSitemapIndex(_req: Request, res: Response): void {
    const today = new Date().toISOString().split('T')[0];

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      '  <sitemap>',
      `    <loc>${BASE_URL}/service-sitemap.xml</loc>`,
      `    <lastmod>${today}</lastmod>`,
      '  </sitemap>',
      '  <sitemap>',
      `    <loc>${BASE_URL}/resource-sitemap.xml</loc>`,
      `    <lastmod>${today}</lastmod>`,
      '  </sitemap>',
      '  <sitemap>',
      `    <loc>${BASE_URL}/location-sitemap.xml</loc>`,
      `    <lastmod>${today}</lastmod>`,
      '  </sitemap>',
      '</sitemapindex>',
    ].join('\n');

    res.header('Content-Type', 'application/xml; charset=utf-8');
    res.send(xml);
  }

  /**
   * Serves dynamic active service sitemap (/service-sitemap.xml)
   * Fetches only active services from database
   */
  static async getServiceSitemap(_req: Request, res: Response): Promise<void> {
    try {
      const result = await ServiceRepository.listServices({
        activeOnly: true,
        limit: 500,
      });

      const today = new Date().toISOString().split('T')[0];

      const urlEntries = result.services.map((svc) => {
        const regionPrefix = (svc.region || 'INDIA').toLowerCase();
        const loc = `${BASE_URL}/${regionPrefix}/${svc.slug}/`;
        const lastmod = svc.created_at
          ? new Date(svc.created_at).toISOString().split('T')[0]
          : today;
        const priority = svc.is_featured ? '0.9' : '0.8';

        return [
          '  <url>',
          `    <loc>${loc}</loc>`,
          `    <lastmod>${lastmod}</lastmod>`,
          '    <changefreq>weekly</changefreq>',
          `    <priority>${priority}</priority>`,
          '  </url>',
        ].join('\n');
      });

      const xml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...urlEntries,
        '</urlset>',
      ].join('\n');

      res.header('Content-Type', 'application/xml; charset=utf-8');
      res.send(xml);
    } catch (err) {
      console.error('Error generating service sitemap:', err);
      res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
    }
  }

  /**
   * Serves resource / core page sitemap (/resource-sitemap.xml)
   */
  static getResourceSitemap(_req: Request, res: Response): void {
    const today = new Date().toISOString().split('T')[0];

    const corePages = [
      { path: '/', priority: '1.0', changefreq: 'daily' },
      { path: '/services/', priority: '0.9', changefreq: 'daily' },
      { path: '/india/', priority: '0.9', changefreq: 'daily' },
      { path: '/uae/', priority: '0.9', changefreq: 'daily' },
      { path: '/about/', priority: '0.8', changefreq: 'monthly' },
      { path: '/contact/', priority: '0.8', changefreq: 'monthly' },
      { path: '/calculator/', priority: '0.7', changefreq: 'weekly' },
      { path: '/track/', priority: '0.6', changefreq: 'weekly' },
    ];

    const urlEntries = corePages.map((page) => {
      const loc = `${BASE_URL}${page.path}`;
      return [
        '  <url>',
        `    <loc>${loc}</loc>`,
        `    <lastmod>${today}</lastmod>`,
        `    <changefreq>${page.changefreq}</changefreq>`,
        `    <priority>${page.priority}</priority>`,
        '  </url>',
      ].join('\n');
    });

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...urlEntries,
      '</urlset>',
    ].join('\n');

    res.header('Content-Type', 'application/xml; charset=utf-8');
    res.send(xml);
  }

  /**
   * Serves location sitemap architecture placeholder (/location-sitemap.xml)
   */
  static getLocationSitemap(_req: Request, res: Response): void {
    const today = new Date().toISOString().split('T')[0];

    const locationPages = [
      { path: '/india/', priority: '0.9' },
      { path: '/uae/', priority: '0.9' },
    ];

    const urlEntries = locationPages.map((locPage) => [
      '  <url>',
      `    <loc>${BASE_URL}${locPage.path}</loc>`,
      `    <lastmod>${today}</lastmod>`,
      '    <changefreq>weekly</changefreq>',
      `    <priority>${locPage.priority}</priority>`,
      '  </url>',
    ].join('\n'));

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...urlEntries,
      '</urlset>',
    ].join('\n');

    res.header('Content-Type', 'application/xml; charset=utf-8');
    res.send(xml);
  }
}
