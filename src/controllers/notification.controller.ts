import { Request, Response, NextFunction } from 'express';
import { NotificationService } from '../services/notification.service';
import { ResponseFormatter } from '../utils/apiResponse';

export class NotificationController {
  static async getUnread(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : 50;
      const result = await NotificationService.getUnread(req.user!.id, limit);
      ResponseFormatter.success(res, result.notifications, undefined, 200, {
        page: 1,
        limit,
        total: result.unreadCount,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      });
    } catch (error) {
      next(error);
    }
  }

  static async markRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const notificationId = parseInt(req.params['id']!, 10);
      await NotificationService.markRead(notificationId, req.user!.id);
      ResponseFormatter.success(res, null, 'Notification marked as read');
    } catch (error) {
      next(error);
    }
  }

  static async markAllRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await NotificationService.markAllRead(req.user!.id);
      ResponseFormatter.success(res, null, 'All notifications marked as read');
    } catch (error) {
      next(error);
    }
  }
}
