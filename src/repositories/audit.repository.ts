import { pool, RowDataPacket } from '../config/database';

export class AuditRepository {
  static async listByEntity(entityType: string, entityId: number, limit: number, offset: number): Promise<{ logs: any[]; total: number }> {
    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM audit_logs WHERE entity_type = ? AND entity_id = ?`,
      [entityType, entityId]
    );
    const total = countRows[0]?.['total'] || 0;

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT al.id, al.action, al.entity_type, al.entity_id, al.old_values, al.new_values, al.ip_address, al.created_at,
              u.first_name AS user_first_name, u.last_name AS user_last_name
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id
       WHERE al.entity_type = ? AND al.entity_id = ?
       ORDER BY al.created_at DESC
       LIMIT ? OFFSET ?`,
      [entityType, entityId, limit, offset]
    );

    return { logs: rows, total };
  }

  static async listByUser(userId: number, limit: number, offset: number): Promise<{ logs: any[]; total: number }> {
    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM audit_logs WHERE user_id = ?`,
      [userId]
    );
    const total = countRows[0]?.['total'] || 0;

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, action, entity_type, entity_id, old_values, new_values, ip_address, created_at
       FROM audit_logs
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );

    return { logs: rows, total };
  }

  static async list(params: {
    action?: string;
    entityType?: string;
    search?: string;
    limit: number;
    offset: number;
  }): Promise<{ logs: any[]; total: number }> {
    let sql = `
      SELECT al.id, al.action, al.entity_type, al.entity_id, al.old_values, al.new_values, al.ip_address, al.user_agent, al.created_at,
             u.id AS user_id, u.email AS user_email, u.first_name AS user_first_name, u.last_name AS user_last_name
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE 1=1
    `;
    const values: any[] = [];

    if (params.action) {
      sql += ` AND al.action = ?`;
      values.push(params.action);
    }
    if (params.entityType) {
      sql += ` AND al.entity_type = ?`;
      values.push(params.entityType);
    }
    if (params.search) {
      sql += ` AND (al.action LIKE ? OR u.email LIKE ? OR u.first_name LIKE ? OR al.ip_address LIKE ?)`;
      const s = `%${params.search}%`;
      values.push(s, s, s, s);
    }

    const countSql = `SELECT COUNT(*) AS total FROM (${sql}) AS counted`;
    const [countRows] = await pool.query<RowDataPacket[]>(countSql, values);
    const total = Number(countRows[0]?.['total'] || 0);

    sql += ` ORDER BY al.id DESC LIMIT ? OFFSET ?`;
    values.push(params.limit, params.offset);

    const [rows] = await pool.query<RowDataPacket[]>(sql, values);
    return { logs: rows, total };
  }
}
