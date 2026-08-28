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

  static async getSuperAdminSummary(): Promise<{
    totalUsers: number;
    totalClients: number;
    totalApplications: number;
    totalServices: number;
    activeServices: number;
    totalCategories: number;
    activeCategories: number;
    recentPriceChanges: any[];
    recentLogs: any[];
  }> {
    if (!pool || typeof pool.query !== 'function') {
      return {
        totalUsers: 0,
        totalClients: 0,
        totalApplications: 0,
        totalServices: 0,
        activeServices: 0,
        totalCategories: 0,
        activeCategories: 0,
        recentPriceChanges: [],
        recentLogs: [],
      };
    }

    const [uRows] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS total FROM users WHERE deleted_at IS NULL');
    const [cRows] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS total FROM clients WHERE deleted_at IS NULL');
    const [aRows] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS total FROM applications');
    const [sRows] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN is_active=1 THEN 1 ELSE 0 END), 0) AS active FROM services WHERE deleted_at IS NULL'
    );
    const [scRows] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN is_active=1 THEN 1 ELSE 0 END), 0) AS active FROM service_categories WHERE deleted_at IS NULL'
    );
    let recentPriceChanges: any[] = [];
    try {
      const [pRows] = await pool.query<RowDataPacket[]>(
        `SELECT sph.*, s.name AS service_name, CONCAT(u.first_name, ' ', u.last_name) AS changed_by_name
         FROM service_price_history sph
         JOIN services s ON s.id = sph.service_id
         LEFT JOIN users u ON u.id = sph.changed_by
         ORDER BY sph.created_at DESC
         LIMIT 5`
      );
      recentPriceChanges = pRows;
    } catch {
      recentPriceChanges = [];
    }

    const [lRows] = await pool.query<RowDataPacket[]>(
      `SELECT al.*, u.email AS user_email, u.first_name AS user_first_name, u.last_name AS user_last_name
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id
       ORDER BY al.created_at DESC
       LIMIT 6`
    );

    return {
      totalUsers: Number(uRows[0]?.['total'] || 0),
      totalClients: Number(cRows[0]?.['total'] || 0),
      totalApplications: Number(aRows[0]?.['total'] || 0),
      totalServices: Number(sRows[0]?.['total'] || 0),
      activeServices: Number(sRows[0]?.['active'] || 0),
      totalCategories: Number(scRows[0]?.['total'] || 0),
      activeCategories: Number(scRows[0]?.['active'] || 0),
      recentPriceChanges,
      recentLogs: lRows || [],
    };
  }
}
