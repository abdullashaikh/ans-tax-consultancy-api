import { pool, RowDataPacket, ResultSetHeader } from '../config/database';
import { LeadRecord, LeadStatus } from '../types/models';

export class LeadRepository {
  static async findById(id: number): Promise<LeadRecord | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM leads WHERE id = ? LIMIT 1`,
      [id]
    );
    return (rows[0] as LeadRecord) || null;
  }

  static async findByPublicId(publicId: string): Promise<LeadRecord | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT l.*, s.name AS service_name, u.first_name AS assigned_first_name, u.last_name AS assigned_last_name
       FROM leads l
       LEFT JOIN services s ON s.id = l.service_id
       LEFT JOIN users u ON u.id = l.assigned_to
       WHERE l.public_id = ?
       LIMIT 1`,
      [publicId]
    );
    return (rows[0] as LeadRecord) || null;
  }

  static async create(params: {
    publicId: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    serviceId?: number | null;
    businessType?: string | null;
    city?: string | null;
    message?: string | null;
    source?: string;
  }): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO leads (public_id, name, email, phone, service_id, business_type, city, message, source, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'NEW')`,
      [
        params.publicId,
        params.name,
        params.email || null,
        params.phone || null,
        params.serviceId || null,
        params.businessType || null,
        params.city || null,
        params.message || null,
        params.source || 'WEBSITE',
      ]
    );
    return result.insertId;
  }

  static async updateStatus(id: number, status: LeadStatus, assignedTo?: number): Promise<void> {
    const updates = ['status = ?'];
    const values: any[] = [status];

    if (assignedTo !== undefined) {
      updates.push('assigned_to = ?');
      values.push(assignedTo);
    }

    values.push(id);
    await pool.query(`UPDATE leads SET ${updates.join(', ')} WHERE id = ?`, values);
  }

  static async markConverted(id: number, convertedClientId: number): Promise<void> {
    await pool.query(
      `UPDATE leads SET status = 'CONVERTED', converted_client_id = ? WHERE id = ?`,
      [convertedClientId, id]
    );
  }

  static async list(params: {
    status?: string;
    assignedTo?: number;
    search?: string;
    limit: number;
    offset: number;
  }): Promise<{ leads: any[]; total: number }> {
    const conditions: string[] = [];
    const values: any[] = [];

    if (params.status) {
      conditions.push('l.status = ?');
      values.push(params.status);
    }
    if (params.assignedTo) {
      conditions.push('l.assigned_to = ?');
      values.push(params.assignedTo);
    }
    if (params.search) {
      conditions.push('(l.name LIKE ? OR l.email LIKE ? OR l.phone LIKE ? OR l.city LIKE ?)');
      const term = `%${params.search}%`;
      values.push(term, term, term, term);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM leads l ${whereClause}`,
      values
    );
    const total = countRows[0]?.['total'] || 0;

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT l.*, s.name AS service_name,
              u.first_name AS assigned_first_name, u.last_name AS assigned_last_name
       FROM leads l
       LEFT JOIN services s ON s.id = l.service_id
       LEFT JOIN users u ON u.id = l.assigned_to
       ${whereClause}
       ORDER BY l.created_at DESC
       LIMIT ? OFFSET ?`,
      [...values, params.limit, params.offset]
    );

    return { leads: rows, total };
  }
}
