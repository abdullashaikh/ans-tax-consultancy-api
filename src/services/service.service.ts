import { ServiceRepository, ServiceListFilter } from '../repositories/service.repository';
import { ApiError } from '../utils/apiError';
import { ErrorCodes } from '../constants/errorCodes';
import { AuditService } from '../middleware/audit.middleware';
import { ServiceRegion, CategoryRegion, PublicServiceDetailResponse } from '../types/models';

export class ServiceService {
  // ==========================================================================
  // CATEGORIES
  // ==========================================================================

  static async listCategories(params?: { activeOnly?: boolean; region?: string }) {
    return ServiceRepository.listCategories(params);
  }

  static async getCategoryById(id: number) {
    const category = await ServiceRepository.findCategoryById(id);
    if (!category) {
      throw ApiError.notFound('Service category not found', ErrorCodes.RESOURCE_NOT_FOUND);
    }
    return category;
  }

  static async getCategoryBySlug(slug: string, region?: string) {
    const category = await ServiceRepository.findCategoryBySlug(slug, region);
    if (!category) {
      throw ApiError.notFound('Category not found', ErrorCodes.RESOURCE_NOT_FOUND);
    }
    const servicesResult = await ServiceRepository.listServices({
      categoryId: category.id,
      region,
      activeOnly: true,
    });
    return { ...category, services: servicesResult.services };
  }

  static async createCategory(
    data: {
      name: string;
      slug: string;
      region?: CategoryRegion;
      description?: string | null;
      icon?: string | null;
      displayOrder?: number;
      isActive?: boolean;
    },
    userId?: number,
    ipAddress?: string,
    userAgent?: string
  ) {
    const existing = await ServiceRepository.findCategoryBySlug(data.slug, data.region);
    if (existing) {
      throw ApiError.conflict('A category with this URL slug already exists in this region.');
    }

    const categoryId = await ServiceRepository.createCategory(data);

    await AuditService.log({
      userId,
      action: 'CATEGORY_CREATED',
      entityType: 'SERVICE_CATEGORY',
      entityId: categoryId,
      newValues: data,
      ipAddress,
      userAgent,
    });

    return ServiceRepository.findCategoryById(categoryId);
  }

  static async updateCategory(
    id: number,
    data: {
      name?: string;
      slug?: string;
      region?: CategoryRegion;
      description?: string | null;
      icon?: string | null;
      displayOrder?: number;
      isActive?: boolean;
    },
    userId?: number,
    ipAddress?: string,
    userAgent?: string
  ) {
    const existing = await ServiceRepository.findCategoryById(id);
    if (!existing) {
      throw ApiError.notFound('Service category not found', ErrorCodes.RESOURCE_NOT_FOUND);
    }

    if (data.slug && data.slug !== existing.slug) {
      const slugConflict = await ServiceRepository.findCategoryBySlug(data.slug, data.region || existing.region);
      if (slugConflict && slugConflict.id !== id) {
        throw ApiError.conflict('A category with this URL slug already exists in this region.');
      }
    }

    if (data.isActive === false && existing.is_active) {
      const activeServiceCount = await ServiceRepository.countServicesByCategoryId(id, true);
      if (activeServiceCount > 0) {
        throw ApiError.badRequest(
          `Cannot deactivate category "${existing.name}" because it currently has ${activeServiceCount} active service(s) assigned. Please reassign or deactivate the services first.`
        );
      }
    }

    await ServiceRepository.updateCategory(id, data);

    await AuditService.log({
      userId,
      action: 'CATEGORY_UPDATED',
      entityType: 'SERVICE_CATEGORY',
      entityId: id,
      oldValues: existing,
      newValues: data,
      ipAddress,
      userAgent,
    });

    return ServiceRepository.findCategoryById(id);
  }

  static async deleteCategory(
    id: number,
    userId?: number,
    ipAddress?: string,
    userAgent?: string
  ) {
    const existing = await ServiceRepository.findCategoryById(id);
    if (!existing) {
      throw ApiError.notFound('Service category not found', ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const activeServiceCount = await ServiceRepository.countServicesByCategoryId(id, true);
    if (activeServiceCount > 0) {
      throw ApiError.badRequest(
        `Cannot delete category "${existing.name}" because it currently has ${activeServiceCount} active service(s) assigned. Please reassign or deactivate the services first.`
      );
    }

    await ServiceRepository.deleteCategory(id);

    await AuditService.log({
      userId,
      action: 'CATEGORY_DEACTIVATED',
      entityType: 'SERVICE_CATEGORY',
      entityId: id,
      oldValues: existing,
      ipAddress,
      userAgent,
    });

    return { message: 'Category deactivated successfully' };
  }

  // ==========================================================================
  // SERVICES
  // ==========================================================================

  static async listServices(params: ServiceListFilter) {
    return ServiceRepository.listServices(params);
  }

  static async getServiceById(id: number) {
    const service = await ServiceRepository.findServiceById(id);
    if (!service) {
      throw ApiError.notFound('Service not found', ErrorCodes.RESOURCE_NOT_FOUND);
    }
    return service;
  }

  static formatPublicDetailResponse(service: any): PublicServiceDetailResponse {
    const isCustomQuote =
      service.pricing_mode === 'CUSTOM_QUOTE' ||
      service.base_price === null ||
      service.som_number === 105;

    const basePrice = isCustomQuote ? null : service.base_price;
    const promoPrice = isCustomQuote ? null : (service.promo_price || service.discount_price || null);
    const effectivePrice = isCustomQuote
      ? 'Price to be discussed on call'
      : (promoPrice !== null ? promoPrice : basePrice);

    return {
      id: service.id,
      somNumber: service.som_number || null,
      name: service.name,
      slug: service.slug,
      region: service.region || 'INDIA',
      category: {
        id: service.category_id,
        name: service.category_name || 'General',
        slug: service.category_slug || 'general',
      },
      shortDescription: service.short_description || null,
      description: service.description || null,
      featured: Boolean(service.is_featured),
      pricing: {
        basePrice,
        promoPrice,
        effectivePrice,
        currency: service.currency || (service.region === 'UAE' ? 'AED' : 'INR'),
        billingPeriod: service.billing_period || 'one-time',
        pricingType: isCustomQuote ? 'CUSTOM_QUOTE' : (service.pricing_mode || 'FIXED'),
        notes: service.pricing_notes || null,
        exclusions: Array.isArray(service.exclusions) ? service.exclusions : [],
      },
      content: {
        overview: service.overview || null,
        eligibility: service.eligibility || null,
        documents: service.structured_documents || service.required_documents || [],
        deliverables: Array.isArray(service.deliverables) ? service.deliverables : [],
        process: service.structured_process_steps || service.process_steps || [],
        turnaround: service.turnaround || service.processing_time || null,
      },
      seo: {
        title: service.seo_title || null,
        metaDescription: service.meta_description || null,
        h1: service.h1_heading || null,
      },
      faqs: (service.faqs || []).map((f: any) => ({
        id: f.id,
        question: f.question,
        answer: f.answer,
        displayOrder: f.display_order,
      })),
      relatedServices: service.related_services_resolved || [],
      cta: {
        text: service.primary_cta_text || 'Book Consultation',
        link: service.primary_cta_link || '/portal/register',
        type: service.cta_type || 'CONSULTATION',
      },
    };
  }

  static async getServiceByRegionAndSlug(
    region: string,
    slug: string,
    publicSafe: boolean = true
  ) {
    const normalizedRegion = region.toUpperCase();
    if (normalizedRegion !== 'INDIA' && normalizedRegion !== 'UAE') {
      throw ApiError.badRequest('Invalid region specified. Allowed regions: "india", "uae".');
    }

    const service = await ServiceRepository.findServiceByRegionAndSlug(
      normalizedRegion,
      slug,
      publicSafe // When publicSafe, enforce is_active = 1
    );

    if (!service) {
      throw ApiError.notFound(
        `Service "${slug}" not found in region "${region}".`,
        ErrorCodes.RESOURCE_NOT_FOUND
      );
    }

    if (publicSafe) {
      return this.formatPublicDetailResponse(service);
    }

    return service;
  }

  static async getServiceBySlug(slug: string) {
    const service = await ServiceRepository.findServiceBySlug(slug);
    if (!service) {
      throw ApiError.notFound('Service not found', ErrorCodes.RESOURCE_NOT_FOUND);
    }
    return service;
  }

  static async createService(
    data: {
      somNumber?: number | null;
      categoryId: number;
      name: string;
      slug: string;
      region?: ServiceRegion;
      icon?: string | null;
      shortDescription?: string | null;
      description?: string | null;
      features?: any | null;
      overview?: string | null;
      eligibility?: string | null;
      documentsRequiredDescription?: string | null;
      requiredDocuments?: any | null;
      deliverables?: any | null;
      processSteps?: any | null;
      processingTime?: string | null;
      turnaround?: string | null;
      basePrice?: number | null;
      discountPrice?: number | null;
      promoPrice?: number | null;
      pricingNotes?: string | null;
      exclusions?: any | null;
      relatedServiceIds?: number[] | null;
      seoTitle?: string | null;
      metaDescription?: string | null;
      h1Heading?: string | null;
      primaryCtaText?: string | null;
      primaryCtaLink?: string | null;
      ctaType?: string | null;
      currency?: string;
      billingPeriod?: string;
      pricingMode?: string;
      isActive?: boolean;
      isFeatured?: boolean;
      displayOrder?: number;
      faqs?: Array<{ question: string; answer: string; displayOrder?: number }>;
      documentsList?: Array<{ name: string; description?: string; isRequired?: boolean }>;
      processStepsList?: Array<{ stepNumber?: number; title: string; description: string }>;
    },
    userId?: number,
    ipAddress?: string,
    userAgent?: string
  ) {
    const region = data.region || 'INDIA';
    const existingSlug = await ServiceRepository.findServiceByRegionAndSlug(region, data.slug, false);
    if (existingSlug) {
      throw ApiError.conflict(`A service with URL slug "${data.slug}" already exists in region ${region}.`);
    }

    const category = await ServiceRepository.findCategoryById(data.categoryId);
    if (!category) {
      throw ApiError.badRequest('Invalid category ID provided.');
    }

    if (data.basePrice !== undefined && data.basePrice !== null && data.basePrice < 0) {
      throw ApiError.badRequest('Base price cannot be negative.');
    }
    if (data.discountPrice !== undefined && data.discountPrice !== null && data.discountPrice < 0) {
      throw ApiError.badRequest('Discount price cannot be negative.');
    }
    if (data.promoPrice !== undefined && data.promoPrice !== null && data.promoPrice < 0) {
      throw ApiError.badRequest('Promotional price cannot be negative.');
    }

    const serviceId = await ServiceRepository.createService(data);

    if (data.basePrice !== undefined && data.basePrice !== null) {
      await ServiceRepository.recordPriceHistory({
        serviceId,
        previousBasePrice: null,
        newBasePrice: data.basePrice,
        previousDiscountPrice: null,
        newDiscountPrice: data.promoPrice !== undefined ? data.promoPrice : (data.discountPrice || null),
        currency: data.currency || (region === 'UAE' ? 'AED' : 'INR'),
        changedBy: userId,
        reason: 'Initial service catalogue creation',
      });
    }

    await AuditService.log({
      userId,
      action: 'SERVICE_CREATED',
      entityType: 'SERVICE',
      entityId: serviceId,
      newValues: data,
      ipAddress,
      userAgent,
    });

    return ServiceRepository.findServiceById(serviceId);
  }

  static async updateService(
    id: number,
    data: {
      somNumber?: number | null;
      categoryId?: number;
      name?: string;
      slug?: string;
      region?: ServiceRegion;
      icon?: string | null;
      shortDescription?: string | null;
      description?: string | null;
      features?: any | null;
      overview?: string | null;
      eligibility?: string | null;
      documentsRequiredDescription?: string | null;
      requiredDocuments?: any | null;
      deliverables?: any | null;
      processSteps?: any | null;
      processingTime?: string | null;
      turnaround?: string | null;
      basePrice?: number | null;
      discountPrice?: number | null;
      promoPrice?: number | null;
      pricingNotes?: string | null;
      exclusions?: any | null;
      relatedServiceIds?: number[] | null;
      seoTitle?: string | null;
      metaDescription?: string | null;
      h1Heading?: string | null;
      primaryCtaText?: string | null;
      primaryCtaLink?: string | null;
      ctaType?: string | null;
      currency?: string;
      billingPeriod?: string;
      pricingMode?: string;
      isActive?: boolean;
      isFeatured?: boolean;
      displayOrder?: number;
      faqs?: Array<{ question: string; answer: string; displayOrder?: number }>;
      documentsList?: Array<{ name: string; description?: string; isRequired?: boolean }>;
      processStepsList?: Array<{ stepNumber?: number; title: string; description: string }>;
    },
    userId?: number,
    ipAddress?: string,
    userAgent?: string
  ) {
    const existing = await ServiceRepository.findServiceById(id);
    if (!existing) {
      throw ApiError.notFound('Service not found', ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const targetRegion = data.region || existing.region || 'INDIA';

    if (data.slug && (data.slug !== existing.slug || (data.region && data.region !== existing.region))) {
      const slugConflict = await ServiceRepository.findServiceByRegionAndSlug(targetRegion, data.slug, false);
      if (slugConflict && slugConflict.id !== id) {
        throw ApiError.conflict(`A service with URL slug "${data.slug}" already exists in region ${targetRegion}.`);
      }
    }

    if (data.categoryId) {
      const category = await ServiceRepository.findCategoryById(data.categoryId);
      if (!category) {
        throw ApiError.badRequest('Invalid category ID provided.');
      }
    }

    if (data.relatedServiceIds && Array.isArray(data.relatedServiceIds)) {
      if (data.relatedServiceIds.includes(id)) {
        throw ApiError.badRequest('A service cannot reference itself in related services.');
      }
    }

    const basePriceChanged =
      data.basePrice !== undefined &&
      data.basePrice !== null &&
      Number(data.basePrice) !== Number(existing.base_price);
    const promoPriceChanged =
      data.promoPrice !== undefined &&
      data.promoPrice !== null &&
      Number(data.promoPrice) !== Number(existing.promo_price || existing.discount_price);

    if (basePriceChanged || promoPriceChanged) {
      const newBase = data.basePrice !== undefined && data.basePrice !== null ? data.basePrice : (existing.base_price ? Number(existing.base_price) : null);
      const newPromo = data.promoPrice !== undefined ? data.promoPrice : (data.discountPrice !== undefined ? data.discountPrice : (existing.promo_price || existing.discount_price ? Number(existing.promo_price || existing.discount_price) : null));

      await ServiceRepository.recordPriceHistory({
        serviceId: id,
        previousBasePrice: existing.base_price ? Number(existing.base_price) : null,
        newBasePrice: newBase,
        previousDiscountPrice: existing.promo_price || existing.discount_price ? Number(existing.promo_price || existing.discount_price) : null,
        newDiscountPrice: newPromo,
        currency: data.currency || existing.currency || 'INR',
        changedBy: userId,
        reason: 'Service catalogue update',
      });
    }

    await ServiceRepository.updateService(id, data);

    await AuditService.log({
      userId,
      action: 'SERVICE_UPDATED',
      entityType: 'SERVICE',
      entityId: id,
      oldValues: existing,
      newValues: data,
      ipAddress,
      userAgent,
    });

    return ServiceRepository.findServiceById(id);
  }

  static async updateServicePricing(
    id: number,
    data: {
      basePrice?: number | null;
      discountPrice?: number | null;
      promoPrice?: number | null;
      currency?: string;
      reason?: string;
    },
    userId?: number,
    ipAddress?: string,
    userAgent?: string
  ) {
    const existing = await ServiceRepository.findServiceById(id);
    if (!existing) {
      throw ApiError.notFound('Service not found', ErrorCodes.RESOURCE_NOT_FOUND);
    }

    if (data.basePrice !== undefined && data.basePrice !== null && data.basePrice < 0) {
      throw ApiError.badRequest('Base price cannot be negative.');
    }
    if (data.discountPrice !== undefined && data.discountPrice !== null && data.discountPrice < 0) {
      throw ApiError.badRequest('Discount price cannot be negative.');
    }
    if (data.promoPrice !== undefined && data.promoPrice !== null && data.promoPrice < 0) {
      throw ApiError.badRequest('Promotional price cannot be negative.');
    }

    const effectivePromo = data.promoPrice !== undefined ? data.promoPrice : data.discountPrice;
    const effectiveBase = data.basePrice !== undefined ? data.basePrice : (existing.base_price ? Number(existing.base_price) : null);

    await ServiceRepository.recordPriceHistory({
      serviceId: id,
      previousBasePrice: existing.base_price ? Number(existing.base_price) : null,
      newBasePrice: effectiveBase,
      previousDiscountPrice: existing.promo_price || existing.discount_price ? Number(existing.promo_price || existing.discount_price) : null,
      newDiscountPrice: effectivePromo !== undefined ? effectivePromo : null,
      currency: data.currency || existing.currency || 'INR',
      changedBy: userId,
      reason: data.reason || 'Super Admin pricing update',
    });

    await ServiceRepository.updateService(id, {
      basePrice: effectiveBase,
      discountPrice: effectivePromo,
      promoPrice: effectivePromo,
      currency: data.currency || existing.currency || 'INR',
    });

    await AuditService.log({
      userId,
      action: 'SERVICE_PRICING_UPDATED',
      entityType: 'SERVICE',
      entityId: id,
      oldValues: {
        base_price: existing.base_price,
        discount_price: existing.discount_price,
        promo_price: existing.promo_price,
        currency: existing.currency,
      },
      newValues: {
        base_price: effectiveBase,
        discount_price: effectivePromo,
        promo_price: effectivePromo,
        currency: data.currency || existing.currency,
        reason: data.reason,
      },
      ipAddress,
      userAgent,
    });

    return ServiceRepository.findServiceById(id);
  }

  static async getPriceHistory(serviceId: number) {
    const existing = await ServiceRepository.findServiceById(serviceId);
    if (!existing) {
      throw ApiError.notFound('Service not found', ErrorCodes.RESOURCE_NOT_FOUND);
    }
    return ServiceRepository.listPriceHistory(serviceId);
  }

  static async deleteService(
    id: number,
    userId?: number,
    ipAddress?: string,
    userAgent?: string
  ) {
    const existing = await ServiceRepository.findServiceById(id);
    if (!existing) {
      throw ApiError.notFound('Service not found', ErrorCodes.RESOURCE_NOT_FOUND);
    }

    await ServiceRepository.deleteService(id);

    await AuditService.log({
      userId,
      action: 'SERVICE_DEACTIVATED',
      entityType: 'SERVICE',
      entityId: id,
      oldValues: existing,
      ipAddress,
      userAgent,
    });

    return { message: 'Service deactivated successfully' };
  }
}
