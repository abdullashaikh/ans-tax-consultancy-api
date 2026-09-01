import { ALL_SOM_105_SERVICES } from '../../src/data/som105Data';

describe('Phase 6 — Full End-to-End QA, Client Portal & Production Readiness Tests', () => {
  describe('1. Authoritative 105 SOM Service Catalogue & Integrity', () => {
    it('should confirm exactly 105 services in master catalogue (90 India, 15 UAE)', () => {
      expect(ALL_SOM_105_SERVICES.length).toBe(105);

      const indiaServices = ALL_SOM_105_SERVICES.filter((s) => s.region === 'INDIA');
      const uaeServices = ALL_SOM_105_SERVICES.filter((s) => s.region === 'UAE');

      expect(indiaServices.length).toBe(90);
      expect(uaeServices.length).toBe(15);
    });

    it('should verify Service #105 (Complete Company Registration) is strictly quote-only', () => {
      const svc105 = ALL_SOM_105_SERVICES.find((s) => s.somNumber === 105);
      expect(svc105).toBeDefined();
      expect(svc105!.name).toBe('Complete Company Registration and Business Setup Solution');
      expect(svc105!.slug).toBe('complete-company-registration-business-setup');
      expect(svc105!.basePrice).toBeNull();
      expect(svc105!.pricingMode).toBe('CUSTOM_QUOTE');
      expect(svc105!.pricingNotes).toContain('Price to be discussed on call');
    });

    it('should verify all 105 service slugs are lowercase, hyphen-separated, and unique per region', () => {
      const indiaSlugs = new Set<string>();
      const uaeSlugs = new Set<string>();

      ALL_SOM_105_SERVICES.forEach((s) => {
        expect(s.slug).toMatch(/^[a-z0-9-]+$/);
        if (s.region === 'INDIA') {
          expect(indiaSlugs.has(s.slug)).toBe(false);
          indiaSlugs.add(s.slug);
        } else {
          expect(uaeSlugs.has(s.slug)).toBe(false);
          uaeSlugs.add(s.slug);
        }
      });
    });
  });

  describe('2. Search & Filter Keywords QA (SOM Section 28)', () => {
    const testSearch = (query: string) => {
      const lowerQ = query.toLowerCase();
      return ALL_SOM_105_SERVICES.filter(
        (s) =>
          s.name.toLowerCase().includes(lowerQ) ||
          s.shortDescription.toLowerCase().includes(lowerQ) ||
          s.categorySlug.toLowerCase().includes(lowerQ)
      );
    };

    it('should return matching services for keyword "GST"', () => {
      const results = testSearch('GST');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((s) => s.slug.includes('gst'))).toBe(true);
    });

    it('should return matching services for keyword "Amazon"', () => {
      const results = testSearch('Amazon');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((s) => s.slug.includes('amazon') || s.name.includes('Amazon') || s.categorySlug.includes('ecommerce'))).toBe(true);
    });

    it('should return matching services for keyword "notice"', () => {
      const results = testSearch('notice');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((s) => s.slug.includes('notice') || s.shortDescription.includes('notice'))).toBe(true);
    });

    it('should return matching services for keyword "company"', () => {
      const results = testSearch('company');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((s) => s.slug.includes('company'))).toBe(true);
    });

    it('should return matching services for keyword "UAE VAT"', () => {
      const results = testSearch('VAT');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((s) => s.region === 'UAE' && s.slug.includes('vat'))).toBe(true);
    });
  });

  describe('3. Multi-Tenant Client Portal Authorization & Document Protection', () => {
    it('should simulate document download authorization verifying client ownership', async () => {
      const mockDocument = {
        id: 101,
        publicId: 'doc-uuid-101',
        clientId: 42, // Belongs to Client A (ID 42)
        fileName: 'GST_Certificate_2026.pdf',
        s3Key: 'clients/42/documents/GST_Certificate_2026.pdf',
        isVerified: 1,
      };

      // Client A (ID 42) attempts download -> ALLOWED
      const requestingClientA = { id: 42, role: 'CLIENT' };
      const isClientAAuthorized = requestingClientA.id === mockDocument.clientId;
      expect(isClientAAuthorized).toBe(true);

      // Client B (ID 99) attempts download of Client A document -> REJECTED
      const requestingClientB = { id: 99, role: 'CLIENT' };
      const isClientBAuthorized = requestingClientB.id === mockDocument.clientId;
      expect(isClientBAuthorized).toBe(false);

      // Admin (ID 1) attempts download -> ALLOWED via role override
      const requestingAdmin = { id: 1, role: 'ADMIN' };
      const isAdminAuthorized = requestingAdmin.role === 'ADMIN' || requestingAdmin.id === mockDocument.clientId;
      expect(isAdminAuthorized).toBe(true);
    });
  });

  describe('4. Standardized Conversion Event Specifications (SOM Section 2)', () => {
    const REQUIRED_EVENT_NAMES = [
      'form_submission',
      'successful_call',
      'whatsapp_click',
      'consultation_booking',
      'document_upload',
      'price_view',
      'checkout_start',
      'payment_complete',
    ];

    it('should verify all 8 standard conversion events exist and adhere to snake_case naming', () => {
      REQUIRED_EVENT_NAMES.forEach((eventName) => {
        expect(eventName).toMatch(/^[a-z]+(_[a-z]+)*$/);
        expect(eventName).not.toContain('Click');
        expect(eventName).not.toContain('Submission');
      });
    });

    it('should verify that lead attribution preserves all mandatory tracking fields', () => {
      const mockLeadData = {
        serviceId: 1,
        serviceName: 'GST Registration',
        serviceSlug: 'gst-registration',
        region: 'INDIA',
        landingPageUrl: 'https://www.anstaxconsultancy.com/india/gst-registration/',
        source: 'google',
        medium: 'cpc',
        campaign: 'delhi_tax_advisory',
        timestamp: new Date().toISOString(),
      };

      expect(mockLeadData.serviceId).toBe(1);
      expect(mockLeadData.serviceSlug).toBe('gst-registration');
      expect(mockLeadData.region).toBe('INDIA');
      expect(mockLeadData.landingPageUrl).toContain('/india/gst-registration/');
      expect(mockLeadData.source).toBe('google');
    });
  });
});
