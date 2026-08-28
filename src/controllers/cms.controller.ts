import { Request, Response, NextFunction } from 'express';
import { CmsService } from '../services/cms.service';
import { ResponseFormatter } from '../utils/apiResponse';
import { PaginationUtil } from '../utils/pagination';
import { AuditService } from '../middleware/audit.middleware';

export class CmsController {
  // ==========================================================================
  // WEBSITE CONTENT CMS
  // ==========================================================================

  static async getPublicContent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sectionKey = req.query['section'] as string | undefined;
      const content = await CmsService.getPublicContent(sectionKey);
      ResponseFormatter.success(res, content);
    } catch (error) {
      next(error);
    }
  }

  static async getAllContent(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const content = await CmsService.getAllContent();
      ResponseFormatter.success(res, content);
    } catch (error) {
      next(error);
    }
  }

  static async updateContentBatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ipAddress = AuditService.getClientIp(req);
      const userAgent = req.headers['user-agent'];
      const items = Array.isArray(req.body.items) ? req.body.items : [req.body];

      const result = await CmsService.updateContentBatch(
        items,
        req.user?.id,
        ipAddress,
        userAgent
      );
      ResponseFormatter.success(res, result, 'Website content updated successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================================================
  // FAQS & BLOG POSTS
  // ==========================================================================

  static async listFaqs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const serviceId = req.query['serviceId'] ? parseInt(req.query['serviceId'] as string, 10) : undefined;
      const faqs = await CmsService.listFaqs(serviceId);
      ResponseFormatter.success(res, faqs);
    } catch (error) {
      next(error);
    }
  }

  static async listBlogPosts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, offset } = PaginationUtil.parseQuery(req.query);
      const categoryId = req.query['categoryId'] ? parseInt(req.query['categoryId'] as string, 10) : undefined;

      const { posts, total } = await CmsService.listBlogPosts({ categoryId, limit, offset });
      const meta = PaginationUtil.buildMeta(page, limit, total);

      ResponseFormatter.success(res, posts, undefined, 200, meta);
    } catch (error) {
      next(error);
    }
  }

  static async getBlogPostBySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const post = await CmsService.getBlogPostBySlug(req.params['slug']!);
      ResponseFormatter.success(res, post);
    } catch (error) {
      next(error);
    }
  }
}
