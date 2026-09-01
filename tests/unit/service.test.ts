import { ServiceService } from '../../src/services/service.service';
import { ServiceRepository } from '../../src/repositories/service.repository';

// Mock repositories to test business rules in isolation
jest.mock('../../src/repositories/service.repository');
jest.mock('../../src/middleware/audit.middleware', () => ({
  AuditService: {
    log: jest.fn().mockResolvedValue(1),
    getClientIp: jest.fn().mockReturnValue('127.0.0.1'),
  },
}));

describe('Service Architecture & Regional Governance - Unit Tests', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Regional Service Resolution & URL Architecture', () => {
    it('should resolve an India service via region and slug', async () => {
      const mockService = {
        id: 1,
        name: 'GST Registration',
        slug: 'gst-registration',
        region: 'INDIA',
        category_name: 'GST',
        category_slug: 'gst',
        base_price: '1499.00',
        promo_price: '1199.00',
        currency: 'INR',
        turnaround: '3-5 working days',
        is_active: 1,
        deliverables: ['GSTIN Certificate', 'HSN Advisory'],
        process_steps: [
          { step: 1, title: 'Document Submission', description: 'Upload KYC' },
        ],
        faqs: [{ id: 1, question: 'Who needs GST?', answer: 'Businesses over 40L turnover' }],
        related_services: [{ id: 2, name: 'GST Return Filing', slug: 'gst-return-filing' }],
      };

      (ServiceRepository.findServiceByRegionAndSlug as jest.Mock).mockResolvedValue(mockService);

      const result = await ServiceService.getServiceByRegionAndSlug('india', 'gst-registration');

      expect(result).toBeDefined();
      expect(result.region).toBe('INDIA');
      expect(result.slug).toBe('gst-registration');
      expect(result.pricing.currency).toBe('INR');
      expect(result.content.deliverables).toContain('GSTIN Certificate');
      expect(ServiceRepository.findServiceByRegionAndSlug).toHaveBeenCalledWith('INDIA', 'gst-registration', true);
    });

    it('should resolve a UAE service via region and slug', async () => {
      const mockUaeService = {
        id: 101,
        name: 'UAE Corporate Tax Registration',
        slug: 'corporate-tax-registration',
        region: 'UAE',
        category_name: 'UAE Corporate Tax',
        category_slug: 'uae-corporate-tax',
        base_price: '1499.00',
        promo_price: '1199.00',
        currency: 'AED',
        turnaround: '3-5 working days',
        is_active: 1,
      };

      (ServiceRepository.findServiceByRegionAndSlug as jest.Mock).mockResolvedValue(mockUaeService);

      const result = await ServiceService.getServiceByRegionAndSlug('uae', 'corporate-tax-registration');

      expect(result).toBeDefined();
      expect(result.region).toBe('UAE');
      expect(result.pricing.currency).toBe('AED');
      expect(ServiceRepository.findServiceByRegionAndSlug).toHaveBeenCalledWith('UAE', 'corporate-tax-registration', true);
    });

    it('should reject invalid region parameter with 400 Bad Request', async () => {
      await expect(
        ServiceService.getServiceByRegionAndSlug('singapore', 'gst-registration')
      ).rejects.toThrow('Invalid region specified. Allowed regions: "india", "uae".');
    });

    it('should throw 404 when service is not found in specified region', async () => {
      (ServiceRepository.findServiceByRegionAndSlug as jest.Mock).mockResolvedValue(null);

      await expect(
        ServiceService.getServiceByRegionAndSlug('india', 'non-existent-slug')
      ).rejects.toThrow('Service "non-existent-slug" not found in region "india".');
    });
  });

  describe('Service Creation & Structured Validation', () => {
    it('should create a service with structured deliverables, process steps, and pricing', async () => {
      (ServiceRepository.findServiceByRegionAndSlug as jest.Mock).mockResolvedValue(null);
      (ServiceRepository.findCategoryById as jest.Mock).mockResolvedValue({ id: 1, name: 'Income Tax' });
      (ServiceRepository.createService as jest.Mock).mockResolvedValue(42);
      (ServiceRepository.recordPriceHistory as jest.Mock).mockResolvedValue(1);
      (ServiceRepository.findServiceById as jest.Mock).mockResolvedValue({
        id: 42,
        name: 'Salaried ITR Filing',
        slug: 'itr-filing-salaried',
        region: 'INDIA',
        base_price: '999.00',
        promo_price: '799.00',
      });

      const result = await ServiceService.createService({
        categoryId: 1,
        name: 'Salaried ITR Filing',
        slug: 'itr-filing-salaried',
        region: 'INDIA',
        basePrice: 999,
        promoPrice: 799,
        currency: 'INR',
        turnaround: '1-2 working days',
        requiredDocuments: ['PAN Card', 'Form 16'],
        deliverables: ['ITR-V Acknowledgment'],
        processSteps: [{ step: 1, title: 'Upload Form 16', description: 'User submits details' }],
        seoTitle: 'Salaried ITR Filing | ANS Tax',
      });

      expect(result).toBeDefined();
      expect(result?.id).toBe(42);
      expect(ServiceRepository.createService).toHaveBeenCalled();
      expect(ServiceRepository.recordPriceHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          serviceId: 42,
          newBasePrice: 999,
          newDiscountPrice: 799,
          currency: 'INR',
        })
      );
    });

    it('should prevent creating a duplicate slug within the same region', async () => {
      (ServiceRepository.findServiceByRegionAndSlug as jest.Mock).mockResolvedValue({
        id: 1,
        slug: 'gst-registration',
        region: 'INDIA',
      });

      await expect(
        ServiceService.createService({
          categoryId: 2,
          name: 'GST Registration',
          slug: 'gst-registration',
          region: 'INDIA',
        })
      ).rejects.toThrow('A service with URL slug "gst-registration" already exists in region INDIA.');
    });

    it('should prevent self-referencing in related services', async () => {
      (ServiceRepository.findServiceById as jest.Mock).mockResolvedValue({
        id: 5,
        name: 'Pvt Ltd Registration',
        slug: 'private-limited-company-registration',
        region: 'INDIA',
      });

      await expect(
        ServiceService.updateService(5, {
          relatedServiceIds: [1, 2, 5], // 5 is self-reference
        })
      ).rejects.toThrow('A service cannot reference itself in related services.');
    });
  });

  describe('Category Architecture & Safe Deletion Protection', () => {
    it('should allow category deletion if no active services are assigned', async () => {
      (ServiceRepository.findCategoryById as jest.Mock).mockResolvedValue({
        id: 10,
        name: 'Empty Category',
        is_active: 1,
      });
      (ServiceRepository.countServicesByCategoryId as jest.Mock).mockResolvedValue(0);
      (ServiceRepository.deleteCategory as jest.Mock).mockResolvedValue(undefined);

      const res = await ServiceService.deleteCategory(10);
      expect(res.message).toBe('Category deactivated successfully');
      expect(ServiceRepository.deleteCategory).toHaveBeenCalledWith(10);
    });

    it('should prevent category deletion if active services are currently assigned', async () => {
      (ServiceRepository.findCategoryById as jest.Mock).mockResolvedValue({
        id: 2,
        name: 'GST',
        is_active: 1,
      });
      (ServiceRepository.countServicesByCategoryId as jest.Mock).mockResolvedValue(8); // 8 active services

      await expect(ServiceService.deleteCategory(2)).rejects.toThrow(
        'Cannot delete category "GST" because it currently has 8 active service(s) assigned.'
      );
    });
  });

  describe('Pricing Governance & Audit Trail', () => {
    it('should update pricing and record immutable price history entry', async () => {
      (ServiceRepository.findServiceById as jest.Mock).mockResolvedValue({
        id: 1,
        name: 'GST Registration',
        base_price: '1499.00',
        promo_price: '1199.00',
        currency: 'INR',
      });
      (ServiceRepository.recordPriceHistory as jest.Mock).mockResolvedValue(100);
      (ServiceRepository.updateService as jest.Mock).mockResolvedValue(undefined);

      await ServiceService.updateServicePricing(
        1,
        {
          basePrice: 1999,
          promoPrice: 1599,
          currency: 'INR',
          reason: 'Statutory scope expansion',
        },
        99 // caller user ID
      );

      expect(ServiceRepository.recordPriceHistory).toHaveBeenCalledWith({
        serviceId: 1,
        previousBasePrice: 1499,
        newBasePrice: 1999,
        previousDiscountPrice: 1199,
        newDiscountPrice: 1599,
        currency: 'INR',
        changedBy: 99,
        reason: 'Statutory scope expansion',
      });

      expect(ServiceRepository.updateService).toHaveBeenCalledWith(1, {
        basePrice: 1999,
        discountPrice: 1599,
        promoPrice: 1599,
        currency: 'INR',
      });
    });

    it('should reject negative prices during pricing governance updates', async () => {
      (ServiceRepository.findServiceById as jest.Mock).mockResolvedValue({
        id: 1,
        name: 'GST Registration',
      });

      await expect(
        ServiceService.updateServicePricing(1, {
          basePrice: -500,
        })
      ).rejects.toThrow('Base price cannot be negative.');
    });
  });
});
