import { SitemapController } from '../../src/controllers/sitemap.controller';
import { ServiceRepository } from '../../src/repositories/service.repository';

jest.mock('../../src/repositories/service.repository');

describe('Phase 4 — Technical SEO, Sitemaps, Robots & Conversion Tracking Tests', () => {
  let mockReq: any;
  let mockRes: any;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      header: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
    };
    jest.clearAllMocks();
  });

  describe('1. Technical Robots.txt Governance', () => {
    it('should generate valid robots.txt allowing public services and disallowing admin/portal areas', () => {
      SitemapController.getRobotsTxt(mockReq, mockRes);

      expect(mockRes.header).toHaveBeenCalledWith('Content-Type', 'text/plain; charset=utf-8');
      expect(mockRes.send).toHaveBeenCalled();

      const robotsText = mockRes.send.mock.calls[0][0];
      expect(robotsText).toContain('User-agent: *');
      expect(robotsText).toContain('Allow: /');
      expect(robotsText).toContain('Allow: /india');
      expect(robotsText).toContain('Allow: /uae');
      expect(robotsText).toContain('Allow: /services');

      // Ensure private/portal areas are excluded from crawling
      expect(robotsText).toContain('Disallow: /admin');
      expect(robotsText).toContain('Disallow: /portal');
      expect(robotsText).toContain('Disallow: /client-portal');
      expect(robotsText).toContain('Disallow: /api');

      // Reference sitemaps
      expect(robotsText).toContain('Sitemap: https://www.anstaxconsultancy.com/sitemap.xml');
      expect(robotsText).toContain('Sitemap: https://www.anstaxconsultancy.com/service-sitemap.xml');
    });
  });

  describe('2. Master Sitemap Index (/sitemap.xml)', () => {
    it('should return valid XML sitemap index referencing sub-sitemaps', () => {
      SitemapController.getSitemapIndex(mockReq, mockRes);

      expect(mockRes.header).toHaveBeenCalledWith('Content-Type', 'application/xml; charset=utf-8');
      const xml = mockRes.send.mock.calls[0][0];
      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
      expect(xml).toContain('<loc>https://www.anstaxconsultancy.com/service-sitemap.xml</loc>');
      expect(xml).toContain('<loc>https://www.anstaxconsultancy.com/resource-sitemap.xml</loc>');
      expect(xml).toContain('<loc>https://www.anstaxconsultancy.com/location-sitemap.xml</loc>');
    });
  });

  describe('3. Dynamic Active Service Sitemap (/service-sitemap.xml)', () => {
    it('should generate dynamic XML sitemap from active database services only', async () => {
      const mockActiveServices = [
        {
          id: 1,
          slug: 'gst-registration',
          region: 'INDIA',
          is_active: 1,
          is_featured: 1,
          created_at: '2026-08-01T00:00:00Z',
        },
        {
          id: 87,
          slug: 'corporate-tax-registration',
          region: 'UAE',
          is_active: 1,
          is_featured: 0,
          created_at: '2026-08-01T00:00:00Z',
        },
      ];

      (ServiceRepository.listServices as jest.Mock).mockResolvedValue({
        services: mockActiveServices,
        total: 2,
      });

      await SitemapController.getServiceSitemap(mockReq, mockRes);

      expect(mockRes.header).toHaveBeenCalledWith('Content-Type', 'application/xml; charset=utf-8');
      const xml = mockRes.send.mock.calls[0][0];

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
      expect(xml).toContain('<loc>https://www.anstaxconsultancy.com/india/gst-registration/</loc>');
      expect(xml).toContain('<loc>https://www.anstaxconsultancy.com/uae/corporate-tax-registration/</loc>');
      expect(xml).toContain('<priority>0.9</priority>'); // featured service
      expect(xml).toContain('<priority>0.8</priority>'); // standard active service
    });

    it('should strictly exclude inactive or deleted services from the service sitemap', async () => {
      // Repository called with activeOnly: true
      await SitemapController.getServiceSitemap(mockReq, mockRes);

      expect(ServiceRepository.listServices).toHaveBeenCalledWith(
        expect.objectContaining({
          activeOnly: true,
        })
      );
    });
  });

  describe('4. Resource & Location Sitemaps', () => {
    it('should generate valid resource sitemap with core landing routes', () => {
      SitemapController.getResourceSitemap(mockReq, mockRes);

      expect(mockRes.header).toHaveBeenCalledWith('Content-Type', 'application/xml; charset=utf-8');
      const xml = mockRes.send.mock.calls[0][0];

      expect(xml).toContain('<loc>https://www.anstaxconsultancy.com/</loc>');
      expect(xml).toContain('<loc>https://www.anstaxconsultancy.com/services/</loc>');
      expect(xml).toContain('<loc>https://www.anstaxconsultancy.com/india/</loc>');
      expect(xml).toContain('<loc>https://www.anstaxconsultancy.com/uae/</loc>');
      expect(xml).toContain('<loc>https://www.anstaxconsultancy.com/about/</loc>');
      expect(xml).toContain('<loc>https://www.anstaxconsultancy.com/contact/</loc>');
    });

    it('should generate valid location sitemap for future regional centers', () => {
      SitemapController.getLocationSitemap(mockReq, mockRes);

      expect(mockRes.header).toHaveBeenCalledWith('Content-Type', 'application/xml; charset=utf-8');
      const xml = mockRes.send.mock.calls[0][0];

      expect(xml).toContain('<loc>https://www.anstaxconsultancy.com/india/</loc>');
      expect(xml).toContain('<loc>https://www.anstaxconsultancy.com/uae/</loc>');
    });
  });
});
