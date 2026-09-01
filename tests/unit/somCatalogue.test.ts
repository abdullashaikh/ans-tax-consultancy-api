import { ALL_SOM_105_SERVICES, SOM_CATEGORIES_105 } from '../../src/data/som105Data';
import { ServiceService } from '../../src/services/service.service';
import { ServiceRepository } from '../../src/repositories/service.repository';

// Mock Repository and Audit
jest.mock('../../src/repositories/service.repository');
jest.mock('../../src/middleware/audit.middleware', () => ({
  AuditService: {
    log: jest.fn().mockResolvedValue(true),
    getClientIp: jest.fn().mockReturnValue('127.0.0.1'),
  },
}));

describe('Phase 2 — 105 SOM Services & Master Catalogue Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Authoritative SOM 105 Dataset Integrity', () => {
    it('should contain exactly 105 services in the master catalogue', () => {
      expect(ALL_SOM_105_SERVICES.length).toBe(105);
    });

    it('should have 90 India services (1-86, 102-105) and 15 UAE services (87-101)', () => {
      const indiaServices = ALL_SOM_105_SERVICES.filter((s) => s.region === 'INDIA');
      const uaeServices = ALL_SOM_105_SERVICES.filter((s) => s.region === 'UAE');

      expect(indiaServices.length).toBe(90);
      expect(uaeServices.length).toBe(15);
    });

    it('should have sequential SOM numbering from 1 to 105 with no gaps or duplicates', () => {
      const somNumbers = ALL_SOM_105_SERVICES.map((s) => s.somNumber).sort((a, b) => a - b);
      expect(somNumbers.length).toBe(105);
      for (let i = 0; i < 105; i++) {
        expect(somNumbers[i]).toBe(i + 1);
      }
    });

    it('should ensure all slugs are unique within their respective regions', () => {
      const regionSlugSet = new Set<string>();
      for (const svc of ALL_SOM_105_SERVICES) {
        const key = `${svc.region}::${svc.slug.toLowerCase()}`;
        expect(regionSlugSet.has(key)).toBe(false);
        regionSlugSet.add(key);
      }
    });

    it('should verify all categories assigned to services exist in SOM_CATEGORIES_105', () => {
      const categorySlugs = new Set(SOM_CATEGORIES_105.map((c) => c.slug));
      for (const svc of ALL_SOM_105_SERVICES) {
        expect(categorySlugs.has(svc.categorySlug)).toBe(true);
      }
    });

    it('should strictly configure Service #105 with custom quote pricing', () => {
      const svc105 = ALL_SOM_105_SERVICES.find((s) => s.somNumber === 105);
      expect(svc105).toBeDefined();
      expect(svc105?.slug).toBe('complete-company-registration-business-setup');
      expect(svc105?.region).toBe('INDIA');
      expect(svc105?.basePrice).toBeNull();
      expect(svc105?.pricingMode).toBe('CUSTOM_QUOTE');
      expect(svc105?.pricingNotes).toContain('Price to be discussed on call');
    });
  });

  describe('2. Public Service Detail API Response Schema (Section 14)', () => {
    it('should format public service detail response with all required Section 14 keys and no internal leakages', () => {
      const rawMockService = {
        id: 1,
        som_number: 1,
        name: 'GST Registration',
        slug: 'gst-registration',
        region: 'INDIA',
        category_id: 10,
        category_name: 'GST',
        category_slug: 'gst',
        short_description: 'Fast GST registration',
        description: 'Detailed GST registration description',
        is_featured: 1,
        base_price: 1499,
        discount_price: 1199,
        promo_price: 1199,
        currency: 'INR',
        billing_period: 'one-time',
        pricing_mode: 'FIXED',
        pricing_notes: 'Government registration is free',
        exclusions: ['Physical biometric verification'],
        overview: 'Mandatory for businesses',
        eligibility: 'Traders and service providers',
        structured_documents: [{ id: 1, name: 'PAN Card', isRequired: true }],
        deliverables: ['Official GST Certificate'],
        structured_process_steps: [{ step: 1, title: 'Doc Check', description: 'Check docs' }],
        turnaround: '3-7 working days',
        seo_title: 'GST Registration Online',
        meta_description: 'Apply for GST registration',
        h1_heading: 'Online GST Registration',
        faqs: [{ id: 1, question: 'Who needs GST?', answer: 'Businesses > 40L', display_order: 1 }],
        related_services_resolved: [{ id: 2, name: 'GST Return Filing', slug: 'gst-return-filing', region: 'INDIA' }],
        primary_cta_text: 'Get GST Registration',
        primary_cta_link: '/portal/register',
        cta_type: 'REGISTER',
        created_at: '2026-01-01',
        deleted_at: null,
      };

      const formatted = ServiceService.formatPublicDetailResponse(rawMockService);

      // Verify schema keys
      expect(formatted).toHaveProperty('id', 1);
      expect(formatted).toHaveProperty('somNumber', 1);
      expect(formatted).toHaveProperty('name', 'GST Registration');
      expect(formatted).toHaveProperty('slug', 'gst-registration');
      expect(formatted).toHaveProperty('region', 'INDIA');
      expect(formatted).toHaveProperty('category');
      expect(formatted.category).toEqual({ id: 10, name: 'GST', slug: 'gst' });
      expect(formatted).toHaveProperty('shortDescription');
      expect(formatted).toHaveProperty('description');
      expect(formatted).toHaveProperty('featured', true);
      expect(formatted).toHaveProperty('pricing');
      expect(formatted.pricing).toEqual({
        basePrice: 1499,
        promoPrice: 1199,
        effectivePrice: 1199,
        currency: 'INR',
        billingPeriod: 'one-time',
        pricingType: 'FIXED',
        notes: 'Government registration is free',
        exclusions: ['Physical biometric verification'],
      });
      expect(formatted).toHaveProperty('content');
      expect(formatted.content.turnaround).toBe('3-7 working days');
      expect(formatted).toHaveProperty('seo');
      expect(formatted.seo.h1).toBe('Online GST Registration');
      expect(formatted).toHaveProperty('faqs');
      expect(formatted.faqs.length).toBe(1);
      expect(formatted).toHaveProperty('relatedServices');
      expect(formatted).toHaveProperty('cta');
      expect(formatted.cta.type).toBe('REGISTER');

      // Verify no sensitive/internal database columns leak
      expect((formatted as any).deleted_at).toBeUndefined();
      expect((formatted as any).category_id).toBeUndefined();
    });

    it('should format Service #105 with effectivePrice="Price to be discussed on call" and pricingType="CUSTOM_QUOTE"', () => {
      const mockService105 = {
        id: 131,
        som_number: 105,
        name: 'Complete Company Registration and Business Setup Solution',
        slug: 'complete-company-registration-business-setup',
        region: 'INDIA',
        category_id: 12,
        category_name: 'Registration',
        category_slug: 'registration',
        base_price: null,
        promo_price: null,
        pricing_mode: 'CUSTOM_QUOTE',
        pricing_notes: 'Price to be discussed on call',
        currency: 'INR',
        billing_period: 'one-time',
      };

      const formatted = ServiceService.formatPublicDetailResponse(mockService105);

      expect(formatted.somNumber).toBe(105);
      expect(formatted.pricing.basePrice).toBeNull();
      expect(formatted.pricing.promoPrice).toBeNull();
      expect(formatted.pricing.effectivePrice).toBe('Price to be discussed on call');
      expect(formatted.pricing.pricingType).toBe('CUSTOM_QUOTE');
    });
  });

  describe('3. Regional Routing & Service Detail Lookup', () => {
    it('should reject invalid region names with ApiError.badRequest', async () => {
      await expect(
        ServiceService.getServiceByRegionAndSlug('usa', 'gst-registration')
      ).rejects.toThrow('Invalid region specified');
    });

    it('should lookup India services with regional isolation', async () => {
      const mockService = {
        id: 1,
        som_number: 1,
        name: 'GST Registration',
        slug: 'gst-registration',
        region: 'INDIA',
        category_id: 10,
        is_active: 1,
        base_price: 1499,
        currency: 'INR',
      };

      (ServiceRepository.findServiceByRegionAndSlug as jest.Mock).mockResolvedValue(mockService);

      const result = await ServiceService.getServiceByRegionAndSlug('india', 'gst-registration');
      expect(ServiceRepository.findServiceByRegionAndSlug).toHaveBeenCalledWith('INDIA', 'gst-registration', true);
      expect(result.slug).toBe('gst-registration');
      expect(result.region).toBe('INDIA');
    });

    it('should lookup UAE services with regional isolation', async () => {
      const mockUaeService = {
        id: 112,
        som_number: 87,
        name: 'UAE Corporate Tax Registration',
        slug: 'corporate-tax-registration',
        region: 'UAE',
        category_id: 26,
        is_active: 1,
        base_price: 1499,
        currency: 'AED',
      };

      (ServiceRepository.findServiceByRegionAndSlug as jest.Mock).mockResolvedValue(mockUaeService);

      const result = await ServiceService.getServiceByRegionAndSlug('uae', 'corporate-tax-registration');
      expect(ServiceRepository.findServiceByRegionAndSlug).toHaveBeenCalledWith('UAE', 'corporate-tax-registration', true);
      expect(result.slug).toBe('corporate-tax-registration');
      expect(result.region).toBe('UAE');
    });
  });

  describe('4. Pricing Governance & Price Audit History', () => {
    it('should record price history when base price is updated', async () => {
      const existing = {
        id: 1,
        name: 'GST Registration',
        base_price: '1499.00',
        discount_price: '1199.00',
        promo_price: '1199.00',
        currency: 'INR',
      };

      (ServiceRepository.findServiceById as jest.Mock).mockResolvedValue(existing);
      (ServiceRepository.updateService as jest.Mock).mockResolvedValue(true);
      (ServiceRepository.recordPriceHistory as jest.Mock).mockResolvedValue(1);

      await ServiceService.updateServicePricing(1, {
        basePrice: 1799,
        promoPrice: 1399,
        currency: 'INR',
        reason: 'Annual inflation adjustment',
      }, 1);

      expect(ServiceRepository.recordPriceHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          serviceId: 1,
          previousBasePrice: 1499,
          newBasePrice: 1799,
          previousDiscountPrice: 1199,
          newDiscountPrice: 1399,
          currency: 'INR',
          reason: 'Annual inflation adjustment',
        })
      );
    });
  });
});
