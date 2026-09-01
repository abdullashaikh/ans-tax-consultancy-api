import { Request, Response, NextFunction } from 'express';
import { ServiceService } from '../services/service.service';
import { ResponseFormatter } from '../utils/apiResponse';
import { AuditService } from '../middleware/audit.middleware';

export class ServiceController {
  // ==========================================================================
  // CATEGORIES
  // ==========================================================================

  static async listCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const activeOnly = req.query['all'] === 'true' ? false : true;
      const region = req.query['region'] as string | undefined;
      const categories = await ServiceService.listCategories({ activeOnly, region });
      ResponseFormatter.success(res, categories);
    } catch (error) {
      next(error);
    }
  }

  static async getCategoryById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params['id']!, 10);
      const category = await ServiceService.getCategoryById(id);
      ResponseFormatter.success(res, category);
    } catch (error) {
      next(error);
    }
  }

  static async getCategoryBySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const region = req.query['region'] as string | undefined;
      const category = await ServiceService.getCategoryBySlug(req.params['slug']!, region);
      ResponseFormatter.success(res, category);
    } catch (error) {
      next(error);
    }
  }

  static async createCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ipAddress = AuditService.getClientIp(req);
      const userAgent = req.headers['user-agent'];
      const category = await ServiceService.createCategory(
        req.body,
        req.user?.id,
        ipAddress,
        userAgent
      );
      ResponseFormatter.created(res, category, 'Service category created successfully');
    } catch (error) {
      next(error);
    }
  }

  static async updateCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params['id']!, 10);
      const ipAddress = AuditService.getClientIp(req);
      const userAgent = req.headers['user-agent'];
      const updated = await ServiceService.updateCategory(
        id,
        req.body,
        req.user?.id,
        ipAddress,
        userAgent
      );
      ResponseFormatter.success(res, updated, 'Service category updated successfully');
    } catch (error) {
      next(error);
    }
  }

  static async toggleCategoryStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params['id']!, 10);
      const ipAddress = AuditService.getClientIp(req);
      const userAgent = req.headers['user-agent'];
      const updated = await ServiceService.updateCategory(
        id,
        { isActive: req.body.isActive },
        req.user?.id,
        ipAddress,
        userAgent
      );
      ResponseFormatter.success(res, updated, `Category status changed to ${req.body.isActive ? 'Active' : 'Inactive'}`);
    } catch (error) {
      next(error);
    }
  }

  static async deleteCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params['id']!, 10);
      const ipAddress = AuditService.getClientIp(req);
      const userAgent = req.headers['user-agent'];
      const result = await ServiceService.deleteCategory(
        id,
        req.user?.id,
        ipAddress,
        userAgent
      );
      ResponseFormatter.success(res, result, 'Category deactivated successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================================================
  // SERVICES
  // ==========================================================================

  static async listServices(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const categoryId = req.query['categoryId'] ? parseInt(req.query['categoryId'] as string, 10) : undefined;
      const categorySlug = req.query['categorySlug'] as string | undefined;
      const region = req.query['region'] as string | undefined;
      const search = req.query['search'] as string | undefined;
      const featured = req.query['featured'] !== undefined ? req.query['featured'] === 'true' : undefined;
      const activeOnly = req.query['all'] === 'true' ? false : true;
      const page = req.query['page'] ? parseInt(req.query['page'] as string, 10) : 1;
      const limit = req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : 50;

      const result = await ServiceService.listServices({
        categoryId,
        categorySlug,
        region,
        search,
        featured,
        activeOnly,
        page,
        limit,
      });

      // Maintain direct array compatibility on data while providing meta
      ResponseFormatter.success(res, result.services, undefined, 200, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
        hasNextPage: result.page < result.totalPages,
        hasPrevPage: result.page > 1,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getServiceById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params['id']!, 10);
      const service = await ServiceService.getServiceById(id);
      ResponseFormatter.success(res, service);
    } catch (error) {
      next(error);
    }
  }

  static async getServiceByRegionAndSlug(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const region = req.params['region']!;
      const slug = req.params['slug']!;
      const service = await ServiceService.getServiceByRegionAndSlug(region, slug);
      ResponseFormatter.success(res, service);
    } catch (error) {
      next(error);
    }
  }

  static async getServiceBySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const service = await ServiceService.getServiceBySlug(req.params['slug']!);
      ResponseFormatter.success(res, service);
    } catch (error) {
      next(error);
    }
  }

  static async createService(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ipAddress = AuditService.getClientIp(req);
      const userAgent = req.headers['user-agent'];
      const service = await ServiceService.createService(
        req.body,
        req.user?.id,
        ipAddress,
        userAgent
      );
      ResponseFormatter.created(res, service, 'Service created successfully');
    } catch (error) {
      next(error);
    }
  }

  static async updateService(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params['id']!, 10);
      const ipAddress = AuditService.getClientIp(req);
      const userAgent = req.headers['user-agent'];
      const updated = await ServiceService.updateService(
        id,
        req.body,
        req.user?.id,
        ipAddress,
        userAgent
      );
      ResponseFormatter.success(res, updated, 'Service updated successfully');
    } catch (error) {
      next(error);
    }
  }

  static async toggleServiceStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params['id']!, 10);
      const ipAddress = AuditService.getClientIp(req);
      const userAgent = req.headers['user-agent'];
      const updated = await ServiceService.updateService(
        id,
        { isActive: req.body.isActive },
        req.user?.id,
        ipAddress,
        userAgent
      );
      ResponseFormatter.success(res, updated, `Service status changed to ${req.body.isActive ? 'Active' : 'Inactive'}`);
    } catch (error) {
      next(error);
    }
  }

  static async updatePricing(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params['id']!, 10);
      const ipAddress = AuditService.getClientIp(req);
      const userAgent = req.headers['user-agent'];
      const updated = await ServiceService.updateServicePricing(
        id,
        req.body,
        req.user?.id,
        ipAddress,
        userAgent
      );
      ResponseFormatter.success(res, updated, 'Service pricing updated successfully');
    } catch (error) {
      next(error);
    }
  }

  static async getPriceHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params['id']!, 10);
      const history = await ServiceService.getPriceHistory(id);
      ResponseFormatter.success(res, history);
    } catch (error) {
      next(error);
    }
  }

  static async deleteService(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params['id']!, 10);
      const ipAddress = AuditService.getClientIp(req);
      const userAgent = req.headers['user-agent'];
      const result = await ServiceService.deleteService(
        id,
        req.user?.id,
        ipAddress,
        userAgent
      );
      ResponseFormatter.success(res, result, 'Service deactivated successfully');
    } catch (error) {
      next(error);
    }
  }
}
