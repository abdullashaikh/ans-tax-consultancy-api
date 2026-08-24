import { NotificationRepository } from '../repositories/notification.repository';
import { NotificationType } from '../types/models';

export class NotificationService {
  static async sendNotification(params: {
    userId: number;
    type: NotificationType;
    title: string;
    message: string;
    dataJson?: Record<string, any>;
  }) {
    return NotificationRepository.create(params);
  }

  static async getUnread(userId: number, limit?: number) {
    return NotificationRepository.listUnread(userId, limit);
  }

  static async markRead(notificationId: number, userId: number) {
    return NotificationRepository.markAsRead(notificationId, userId);
  }

  static async markAllRead(userId: number) {
    return NotificationRepository.markAllAsRead(userId);
  }
}
