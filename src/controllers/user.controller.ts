import { Request, Response, NextFunction } from 'express';
import { UserService } from '../services/user.service';
import { ResponseFormatter } from '../utils/apiResponse';
import { PaginationUtil } from '../utils/pagination';
import { AuditService } from '../middleware/audit.middleware';

export class UserController {
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, offset, search } = PaginationUtil.parseQuery(req.query);
      const status = req.query['status'] as string | undefined;

      const { users, total } = await UserService.listUsers({ status, search, limit, offset });
      const meta = PaginationUtil.buildMeta(page, limit, total);

      ResponseFormatter.success(res, users, undefined, 200, meta);
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await UserService.getUserByPublicId(req.params['id']!);
      ResponseFormatter.success(res, user);
    } catch (error) {
      next(error);
    }
  }

  static async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const updated = await UserService.updateProfile(req.user!.id, req.body);
      ResponseFormatter.success(res, updated, 'Profile updated successfully');
    } catch (error) {
      next(error);
    }
  }

  static async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ipAddress = AuditService.getClientIp(req);
      const userAgent = req.headers['user-agent'];
      await UserService.changePassword(req.user!.id, {
        currentPassword: req.body.currentPassword,
        newPassword: req.body.newPassword,
        ipAddress,
        userAgent,
      });
      ResponseFormatter.success(res, null, 'Password changed successfully');
    } catch (error) {
      next(error);
    }
  }

  static async createStaff(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ipAddress = AuditService.getClientIp(req);
      const userAgent = req.headers['user-agent'];
      const user = await UserService.createStaffUser(
        req.body,
        { id: req.user!.id, roles: req.user!.roles },
        ipAddress,
        userAgent
      );
      ResponseFormatter.created(res, user, 'Staff user created successfully');
    } catch (error) {
      next(error);
    }
  }

  static async adminUpdate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ipAddress = AuditService.getClientIp(req);
      const userAgent = req.headers['user-agent'];
      const updated = await UserService.adminUpdateUser(
        req.params['id']!,
        req.body,
        { id: req.user!.id, roles: req.user!.roles },
        ipAddress,
        userAgent
      );
      ResponseFormatter.success(res, updated, 'User updated successfully');
    } catch (error) {
      next(error);
    }
  }
}
