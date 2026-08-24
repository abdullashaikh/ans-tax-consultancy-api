import { pool, RowDataPacket, ResultSetHeader } from '../config/database';
import { NotificationRecord, NotificationType } from '../types/models';

export class NotificationRepository {
  static async create(params: {
    userId: number;
    type: NotificationType;
    title: string;
    message: string;
    dataJson?: Record<string, any> | null;
  }): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO notifications (user_id, type, title, message, data_json)
       VALUES (?, ?, ?, ?, ?)`,
      [
        params.userId,
        params.type,
        params.title,
        params.message,
        params.dataJson ? JSON.stringify(params.dataJson) : null,
      ]
    );
    return result.insertId;
  }

  static async markAsRead(notificationId: number, userId: number): Promise<void> {
    await pool.query(
      `UPDATE notifications SET read_at = UTC_TIMESTAMP() WHERE id = ? AND user_id = ? AND read_at IS NULL`,
      [notificationId, userId]
    );
  }

  static async markAllAsRead(userId: number): Promise<void> {
    await pool.query(
      `UPDATE notifications SET read_at = UTC_TIMESTAMP() WHERE user_id = ? AND read_at IS NULL`,
      [userId]
    );
  }

  static async listUnread(userId: number, limit: number = 50): Promise<{ notifications: NotificationRecord[]; unreadCount: number }> {
    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS unread_count FROM notifications WHERE user_id = ? AND read_at IS NULL`,
      [userId]
    );
    const unreadCount = countRows[0]?.['unread_count'] || 0;

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, user_id, type, title, message, data_json, read_at, created_at
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [userId, limit]
    );

    return { notifications: rows as NotificationRecord[], unreadCount };
  }
}
