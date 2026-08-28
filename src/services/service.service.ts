import { ServiceRepository } from '../repositories/service.repository';
import { ApiError } from '../utils/apiError';
import { ErrorCodes } from '../constants/errorCodes';
import { AuditService } from '../middleware/audit.middleware';

export class ServiceService {
  // ==========================================================================
  // CATEGORIES
  // ==========================================================================

  static async listCategories(activeOnly: boolean = true) {
    return ServiceRepository.listCategories(activeOnly);
  }

  static async getCategoryById(id: number) {
    const category = await ServiceRepository.findCategoryById(id);
    if (!category) {
      throw ApiError.notFound('Service category not found', ErrorCodes.RESOURCE_NOT_FOUND);
    }
    return category;
  }

  static async getCategoryBySlug(slug: string) {
    const category = await ServiceRepository.findCategoryBySlug(slug);
    if (!category) {
      throw ApiError.notFound('Category not found', ErrorCodes.RESOURCE_NOT_FOUND);
    }
    const services = await ServiceRepository.listServices({ categoryId: category.id });
    return { ...category, services };
  }

  static async createCategory(
    data: {
      name: string;
      slug: string;
      description?: string | null;
      icon?: string | null;
      displayOrder?: number;
      isActive?: boolean;
    },
    userId?: number,
    ipAddress?: string,
    userAgent?: string
  ) {
    const existing = await ServiceRepository.findCategoryBySlug(data.slug);
    if (existing) {
      throw ApiError.conflict('A category with this URL slug already exists.');
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
      const slugConflict = await ServiceRepository.findCategoryBySlug(data.slug);
      if (slugConflict && slugConflict.id !== id) {
        throw ApiError.conflict('A category with this URL slug already exists.');
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

  static async listServices(params: { categoryId?: number; activeOnly?: boolean }) {
    return ServiceRepository.listServices(params);
  }

  static async getServiceById(id: number) {
    const service = await ServiceRepository.findServiceById(id);
    if (!service) {
      throw ApiError.notFound('Service not found', ErrorCodes.RESOURCE_NOT_FOUND);
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
      categoryId: number;
      name: string;
      slug: string;
      icon?: string | null;
      shortDescription?: string | null;
      description?: string | null;
      features?: any | null;
      eligibility?: string | null;
      documentsRequiredDescription?: string | null;
      processingTime?: string | null;
      basePrice?: number | null;
      discountPrice?: number | null;
      currency?: string;
      isActive?: boolean;
      isFeatured?: boolean;
      displayOrder?: number;
    },
    userId?: number,
    ipAddress?: string,
    userAgent?: string
  ) {
    const existingSlug = await ServiceRepository.findServiceBySlug(data.slug);
    if (existingSlug) {
      throw ApiError.conflict('A service with this URL slug already exists.');
    }

    const category = await ServiceRepository.findCategoryById(data.categoryId);
    if (!category) {
      throw ApiError.badRequest('Invalid category ID provided.');
    }

    const serviceId = await ServiceRepository.createService(data);

    // If initial price is provided, log to price history
    if (data.basePrice !== undefined && data.basePrice !== null) {
      await ServiceRepository.recordPriceHistory({
        serviceId,
        previousBasePrice: null,
        newBasePrice: data.basePrice,
        previousDiscountPrice: null,
        newDiscountPrice: data.discountPrice || null,
        currency: data.currency || 'INR',
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
      categoryId?: number;
      name?: string;
      slug?: string;
      icon?: string | null;
      shortDescription?: string | null;
      description?: string | null;
      features?: any | null;
      eligibility?: string | null;
      documentsRequiredDescription?: string | null;
      processingTime?: string | null;
      basePrice?: number | null;
      discountPrice?: number | null;
      currency?: string;
      isActive?: boolean;
      isFeatured?: boolean;
      displayOrder?: number;
    },
    userId?: number,
    ipAddress?: string,
    userAgent?: string
  ) {
    const existing = await ServiceRepository.findServiceById(id);
    if (!existing) {
      throw ApiError.notFound('Service not found', ErrorCodes.RESOURCE_NOT_FOUND);
    }

    if (data.slug && data.slug !== existing.slug) {
      const slugConflict = await ServiceRepository.findServiceBySlug(data.slug);
      if (slugConflict && slugConflict.id !== id) {
        throw ApiError.conflict('A service with this URL slug already exists.');
      }
    }

    if (data.categoryId && data.categoryId !== existing.category_id) {
      const cat = await ServiceRepository.findCategoryById(data.categoryId);
      if (!cat) {
        throw ApiError.badRequest('Invalid category ID.');
      }
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
      basePrice: number;
      discountPrice?: number | null;
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

    if (data.basePrice < 0) {
      throw ApiError.badRequest('Base price cannot be negative.');
    }
    if (data.discountPrice !== undefined && data.discountPrice !== null && data.discountPrice < 0) {
      throw ApiError.badRequest('Discount price cannot be negative.');
    }

    const prevBasePrice = existing.base_price ? parseFloat(existing.base_price) : null;
    const prevDiscountPrice = existing.discount_price ? parseFloat(existing.discount_price) : null;

    // 1. Update in services table
    await ServiceRepository.updateService(id, {
      basePrice: data.basePrice,
      discountPrice: data.discountPrice !== undefined ? data.discountPrice : null,
      currency: data.currency || existing.currency || 'INR',
    });

    // 2. Record immutable price history
    await ServiceRepository.recordPriceHistory({
      serviceId: id,
      previousBasePrice: prevBasePrice,
      newBasePrice: data.basePrice,
      previousDiscountPrice: prevDiscountPrice,
      newDiscountPrice: data.discountPrice !== undefined ? data.discountPrice : null,
      currency: data.currency || existing.currency || 'INR',
      changedBy: userId,
      reason: data.reason || 'Super Admin pricing update',
    });

    // 3. Central security audit log
    await AuditService.log({
      userId,
      action: 'SERVICE_PRICE_CHANGED',
      entityType: 'SERVICE',
      entityId: id,
      oldValues: { basePrice: prevBasePrice, discountPrice: prevDiscountPrice },
      newValues: { basePrice: data.basePrice, discountPrice: data.discountPrice, reason: data.reason },
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
