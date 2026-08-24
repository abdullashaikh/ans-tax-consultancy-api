import { ServiceRepository } from '../repositories/service.repository';
import { ApiError } from '../utils/apiError';
import { ErrorCodes } from '../constants/errorCodes';

export class ServiceService {
  static async listCategories(activeOnly: boolean = true) {
    return ServiceRepository.listCategories(activeOnly);
  }

  static async getCategoryBySlug(slug: string) {
    const category = await ServiceRepository.findCategoryBySlug(slug);
    if (!category) {
      throw ApiError.notFound('Category not found', ErrorCodes.RESOURCE_NOT_FOUND);
    }
    const services = await ServiceRepository.listServices({ categoryId: category.id });
    return { ...category, services };
  }

  static async listServices(params: { categoryId?: number; activeOnly?: boolean }) {
    return ServiceRepository.listServices(params);
  }

  static async getServiceBySlug(slug: string) {
    const service = await ServiceRepository.findServiceBySlug(slug);
    if (!service) {
      throw ApiError.notFound('Service not found', ErrorCodes.RESOURCE_NOT_FOUND);
    }
    return service;
  }
}
