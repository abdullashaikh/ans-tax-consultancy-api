import { ServiceService } from '../../src/services/service.service';
import { ServiceRepository } from '../../src/repositories/service.repository';
import { ALL_SOM_105_SERVICES, SOM_CATEGORIES_105 } from '../../src/data/som105Data';

jest.mock('../../src/repositories/service.repository');
jest.mock('../../src/middleware/audit.middleware', () => ({
  AuditService: {
    log: jest.fn().mockResolvedValue(1),
    getClientIp: jest.fn().mockReturnValue('127.0.0.1'),
  },
}));

describe('Phase 3 — Public Service Catalogue & Dynamic Page Contract Tests', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Catalogue Data Layer & Filters', () => {
    it('should return all categories for the frontend filter pills', async () => {
      (ServiceRepository.listCategories as jest.Mock).mockResolvedValue(SOM_CATEGORIES_105);

      const categories = await ServiceService.listCategories({ activeOnly: true });
      expect(Array.isArray(categories)).toBe(true);
      expect(categories.length).toBe(23);
      expect(categories.some((c: any) => c.slug === 'gst')).toBe(true);
      expect(categories.some((c: any) => c.slug === 'uae-tax')).toBe(true);
    });

    it('should filter categories by region (INDIA vs UAE)', async () => {
      const indiaCategories = SOM_CATEGORIES_105.filter((c: any) => c.region === 'INDIA');
      (ServiceRepository.listCategories as jest.Mock).mockResolvedValue(indiaCategories);

      const categories = await ServiceService.listCategories({ activeOnly: true, region: 'INDIA' });
      expect(categories.length).toBe(indiaCategories.length);
      categories.forEach((c: any) => expect(c.region).toBe('INDIA'));
    });

    it('should return public active services list for /services page', async () => {
      const mockList = ALL_SOM_105_SERVICES.map((s: any, idx: number) => ({
        id: idx + 1,
        som_number: s.somNumber,
        category_id: 10,
        category_name: s.categoryName,
        category_slug: s.categorySlug,
        name: s.name,
        slug: s.slug,
        region: s.region,
        short_description: s.shortDescription,
        description: s.description,
        turnaround: s.turnaround,
        base_price: s.basePrice,
        discount_price: s.promoPrice,
        promo_price: s.promoPrice,
        currency: s.currency,
        billing_period: s.billingPeriod,
        pricing_mode: s.pricingMode,
        is_active: 1,
        is_featured: s.isFeatured ? 1 : 0,
        display_order: idx + 1,
      }));

      (ServiceRepository.listServices as jest.Mock).mockResolvedValue({
        services: mockList,
        total: 105,
      });

      const result = await ServiceService.listServices({ limit: 150 });
      expect(result.services.length).toBe(105);
      expect(result.total).toBe(105);
    });
  });

  describe('Dynamic Regional Routing: India vs UAE', () => {
    it('should resolve India Service #1 (GST Registration) with Section 14 schema', async () => {
      const gstService = ALL_SOM_105_SERVICES.find((s: any) => s.somNumber === 1)!;
      const mockDbRecord = {
        id: 1,
        som_number: 1,
        name: gstService.name,
        slug: gstService.slug,
        region: 'INDIA',
        category_id: 10,
        category_name: 'GST',
        category_slug: 'gst',
        short_description: gstService.shortDescription,
        description: gstService.description,
        turnaround: gstService.turnaround,
        base_price: gstService.basePrice,
        discount_price: gstService.promoPrice,
        promo_price: gstService.promoPrice,
        currency: 'INR',
        billing_period: 'one-time',
        pricing_mode: 'FIXED',
        is_active: 1,
        is_featured: 1,
        seo_title: gstService.seoTitle,
        meta_description: gstService.metaDescription,
        h1_heading: gstService.h1Heading,
        deliverables: gstService.deliverables,
        process_steps: gstService.processSteps,
        faqs: gstService.faqs,
        related_services: [{ id: 2, name: 'GST Return Filing', slug: 'gst-return-filing', region: 'INDIA' }],
      };

      (ServiceRepository.findServiceByRegionAndSlug as jest.Mock).mockResolvedValue(mockDbRecord);

      const detail = await ServiceService.getServiceByRegionAndSlug('india', 'gst-registration');
      expect(detail).toBeDefined();
      expect(detail.somNumber).toBe(1);
      expect(detail.name).toBe('GST Registration');
      expect(detail.slug).toBe('gst-registration');
      expect(detail.region).toBe('INDIA');
      expect(detail.pricing.currency).toBe('INR');
      expect(detail.pricing.basePrice).toBe(1499);
      expect(detail.pricing.effectivePrice).toBe(1199);
      expect(detail.pricing.pricingType).toBe('FIXED');
      expect(detail.seo.title).toBe(gstService.seoTitle);
      expect(detail.content.deliverables).toEqual(gstService.deliverables);
    });

    it('should resolve UAE Service #87 (UAE Corporate Tax Registration) with AED currency', async () => {
      const uaeService = ALL_SOM_105_SERVICES.find((s: any) => s.somNumber === 87)!;
      const mockDbRecord = {
        id: 87,
        som_number: 87,
        name: uaeService.name,
        slug: uaeService.slug,
        region: 'UAE',
        category_id: 26,
        category_name: 'UAE Tax',
        category_slug: 'uae-tax',
        short_description: uaeService.shortDescription,
        description: uaeService.description,
        turnaround: uaeService.turnaround,
        base_price: uaeService.basePrice,
        discount_price: uaeService.promoPrice,
        promo_price: uaeService.promoPrice,
        currency: 'AED',
        billing_period: 'one-time',
        pricing_mode: 'FIXED',
        is_active: 1,
        is_featured: 0,
        seo_title: uaeService.seoTitle,
        meta_description: uaeService.metaDescription,
        h1_heading: uaeService.h1Heading,
        deliverables: uaeService.deliverables,
        process_steps: uaeService.processSteps,
        faqs: uaeService.faqs,
        related_services: [],
      };

      (ServiceRepository.findServiceByRegionAndSlug as jest.Mock).mockResolvedValue(mockDbRecord);

      const detail = await ServiceService.getServiceByRegionAndSlug('uae', 'corporate-tax-registration');
      expect(detail).toBeDefined();
      expect(detail.somNumber).toBe(87);
      expect(detail.region).toBe('UAE');
      expect(detail.pricing.currency).toBe('AED');
      expect(detail.pricing.basePrice).toBe(1499);
      expect(detail.pricing.effectivePrice).toBe(1199);
    });

    it('should format Service #105 with quote-only pricing and zero artificial numeric price', async () => {
      const svc105 = ALL_SOM_105_SERVICES.find((s: any) => s.somNumber === 105)!;
      const mockDbRecord = {
        id: 105,
        som_number: 105,
        name: svc105.name,
        slug: svc105.slug,
        region: 'INDIA',
        category_id: 12,
        category_name: 'Registration',
        category_slug: 'registration',
        short_description: svc105.shortDescription,
        description: svc105.description,
        turnaround: svc105.turnaround,
        base_price: null,
        discount_price: null,
        promo_price: null,
        currency: 'INR',
        billing_period: 'one-time',
        pricing_mode: 'CUSTOM_QUOTE',
        pricing_notes: 'Price to be discussed on call',
        is_active: 1,
        is_featured: 1,
        seo_title: svc105.seoTitle,
        meta_description: svc105.metaDescription,
        h1_heading: svc105.h1Heading,
        deliverables: svc105.deliverables,
        process_steps: svc105.processSteps,
        faqs: svc105.faqs,
        related_services: [],
      };

      (ServiceRepository.findServiceByRegionAndSlug as jest.Mock).mockResolvedValue(mockDbRecord);

      const detail = await ServiceService.getServiceByRegionAndSlug('india', 'complete-company-registration-business-setup');
      expect(detail).toBeDefined();
      expect(detail.somNumber).toBe(105);
      expect(detail.pricing.basePrice).toBeNull();
      expect(detail.pricing.promoPrice).toBeNull();
      expect(detail.pricing.effectivePrice).toBe('Price to be discussed on call');
      expect(detail.pricing.pricingType).toBe('CUSTOM_QUOTE');
    });

    it('should throw ApiError 404 when service is not found or inactive', async () => {
      (ServiceRepository.findServiceByRegionAndSlug as jest.Mock).mockResolvedValue(null);

      await expect(
        ServiceService.getServiceByRegionAndSlug('india', 'unknown-service-slug')
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'RESOURCE_NOT_FOUND',
      });
    });
  });
});
