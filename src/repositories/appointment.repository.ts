import { pool, RowDataPacket, ResultSetHeader } from '../config/database';
import { AppointmentRecord, AppointmentStatus, AppointmentType } from '../types/models';

export class AppointmentRepository {
  static async findById(id: number): Promise<AppointmentRecord | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM appointments WHERE id = ? LIMIT 1`,
      [id]
    );
    return (rows[0] as AppointmentRecord) || null;
  }

  static async findByPublicId(publicId: string): Promise<AppointmentRecord | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT ap.*, c.legal_name AS client_name,
              u.first_name AS consultant_first_name, u.last_name AS consultant_last_name
       FROM appointments ap
       INNER JOIN clients c ON c.id = ap.client_id
       INNER JOIN users u ON u.id = ap.consultant_id
       WHERE ap.public_id = ?
       LIMIT 1`,
      [publicId]
    );
    return (rows[0] as AppointmentRecord) || null;
  }

  static async create(params: {
    publicId: string;
    clientId: number;
    consultantId: number;
    applicationId?: number | null;
    appointmentType: AppointmentType;
    scheduledStart: Date;
    scheduledEnd: Date;
    meetingUrl?: string | null;
    notes?: string | null;
  }): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO appointments (
        public_id, client_id, consultant_id, application_id,
        appointment_type, scheduled_start, scheduled_end, meeting_url, notes, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'REQUESTED')`,
      [
        params.publicId,
        params.clientId,
        params.consultantId,
        params.applicationId || null,
        params.appointmentType,
        params.scheduledStart,
        params.scheduledEnd,
        params.meetingUrl || null,
        params.notes || null,
      ]
    );
    return result.insertId;
  }

  static async updateStatus(id: number, status: AppointmentStatus): Promise<void> {
    await pool.query(`UPDATE appointments SET status = ? WHERE id = ?`, [status, id]);
  }

  static async list(params: {
    clientId?: number;
    consultantId?: number;
    status?: string;
    fromDate?: Date;
    toDate?: Date;
    limit: number;
    offset: number;
  }): Promise<{ appointments: any[]; total: number }> {
    const conditions: string[] = [];
    const values: any[] = [];

    if (params.clientId) {
      conditions.push('ap.client_id = ?');
      values.push(params.clientId);
    }
    if (params.consultantId) {
      conditions.push('ap.consultant_id = ?');
      values.push(params.consultantId);
    }
    if (params.status) {
      conditions.push('ap.status = ?');
      values.push(params.status);
    }
    if (params.fromDate) {
      conditions.push('ap.scheduled_start >= ?');
      values.push(params.fromDate);
    }
    if (params.toDate) {
      conditions.push('ap.scheduled_start <= ?');
      values.push(params.toDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM appointments ap ${whereClause}`,
      values
    );
    const total = countRows[0]?.['total'] || 0;

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT ap.*, c.legal_name AS client_name, c.public_id AS client_public_id,
              u.first_name AS consultant_first_name, u.last_name AS consultant_last_name
       FROM appointments ap
       INNER JOIN clients c ON c.id = ap.client_id
       INNER JOIN users u ON u.id = ap.consultant_id
       ${whereClause}
       ORDER BY ap.scheduled_start ASC
       LIMIT ? OFFSET ?`,
      [...values, params.limit, params.offset]
    );

    return { appointments: rows, total };
  }
}
