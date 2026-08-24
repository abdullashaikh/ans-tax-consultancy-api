import { Request, Response, NextFunction } from 'express';
import { ServiceService } from '../services/service.service';
import { ResponseFormatter } from '../utils/apiResponse';

export class ServiceController {
  static async listCategories(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const categories = await ServiceService.listCategories();
      ResponseFormatter.success(res, categories);
    } catch (error) {
      next(error);
    }
  }

  static async getCategoryBySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const category = await ServiceService.getCategoryBySlug(req.params['slug']!);
      ResponseFormatter.success(res, category);
    } catch (error) {
      next(error);
    }
  }

  static async listServices(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const categoryId = req.query['categoryId'] ? parseInt(req.query['categoryId'] as string, 10) : undefined;
      const services = await ServiceService.listServices({ categoryId });
      ResponseFormatter.success(res, services);
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
}
