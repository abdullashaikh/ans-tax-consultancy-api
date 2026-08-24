import { pool, RowDataPacket } from '../config/database';

export class SettingRepository {
  static async get(key: string): Promise<RowDataPacket | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT setting_key, setting_value, setting_type, description, is_public FROM system_settings WHERE setting_key = ? LIMIT 1`,
      [key]
    );
    return rows[0] || null;
  }

  static async set(params: {
    key: string;
    value: string;
    type?: string;
    description?: string;
    isPublic?: boolean;
  }): Promise<void> {
    await pool.query(
      `INSERT INTO system_settings (setting_key, setting_value, setting_type, description, is_public)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         setting_value = VALUES(setting_value),
         setting_type = VALUES(setting_type),
         description = COALESCE(VALUES(description), description),
         is_public = VALUES(is_public)`,
      [
        params.key,
        params.value,
        params.type || 'STRING',
        params.description || null,
        params.isPublic ? 1 : 0,
      ]
    );
  }

  static async listPublic(): Promise<RowDataPacket[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT setting_key, setting_value, setting_type, description FROM system_settings WHERE is_public = 1 ORDER BY setting_key ASC`
    );
    return rows;
  }
}
