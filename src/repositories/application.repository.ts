import { pool, withTransaction, RowDataPacket, ResultSetHeader } from '../config/database';
import { ApplicationRecord, ApplicationStatus, ApplicationPriority } from '../types/models';

export class ApplicationRepository {
  static async findById(id: number): Promise<ApplicationRecord | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM applications WHERE id = ? LIMIT 1`,
      [id]
    );
    return (rows[0] as ApplicationRecord) || null;
  }

  static async findByPublicId(publicId: string): Promise<(ApplicationRecord & {
    client_name: string;
    client_public_id: string;
    service_name: string;
    service_slug: string;
    category_name: string;
    consultant_name: string | null;
  }) | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT a.*,
              c.public_id AS client_public_id, c.legal_name AS client_name,
              s.name AS service_name, s.slug AS service_slug,
              sc.name AS category_name,
              CONCAT(u.first_name, ' ', u.last_name) AS consultant_name
       FROM applications a
       INNER JOIN clients c ON c.id = a.client_id
       INNER JOIN services s ON s.id = a.service_id
       INNER JOIN service_categories sc ON sc.id = s.category_id
       LEFT  JOIN users u ON u.id = a.assigned_consultant_id
       WHERE a.public_id = ?
       LIMIT 1`,
      [publicId]
    );
    return (rows[0] as any) || null;
  }

  static async create(params: {
    publicId: string;
    applicationNumber: string;
    clientId: number;
    serviceId: number;
    title: string;
    description?: string | null;
    priority?: ApplicationPriority;
    quotedAmount?: number | null;
    createdBy: number;
  }): Promise<number> {
    return withTransaction(async (conn) => {
      // 1. Insert application
      const [result] = await conn.query<ResultSetHeader>(
        `INSERT INTO applications (
          public_id, application_number, client_id, service_id, title, description,
          status, priority, quoted_amount, currency
        ) VALUES (?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, 'INR')`,
        [
          params.publicId,
          params.applicationNumber,
          params.clientId,
          params.serviceId,
          params.title,
          params.description || null,
          params.priority || 'NORMAL',
          params.quotedAmount || null,
        ]
      );

      const appId = result.insertId;

      // 2. Insert initial status history
      await conn.query(
        `INSERT INTO application_status_history (application_id, old_status, new_status, changed_by)
         VALUES (?, NULL, 'DRAFT', ?)`,
        [appId, params.createdBy]
      );

      return appId;
    });
  }

  static async updateStatus(params: {
    applicationId: number;
    oldStatus: ApplicationStatus;
    newStatus: ApplicationStatus;
    changedBy: number;
    reason?: string | null;
  }): Promise<void> {
    return withTransaction(async (conn) => {
      // 1. Update application status and lifecycle timestamps
      await conn.query(
        `UPDATE applications
         SET status = ?,
             submitted_at = CASE WHEN ? = 'SUBMITTED' AND submitted_at IS NULL THEN UTC_TIMESTAMP() ELSE submitted_at END,
             started_at = CASE WHEN ? = 'IN_PROGRESS' AND started_at IS NULL THEN UTC_TIMESTAMP() ELSE started_at END,
             completed_at = CASE WHEN ? = 'COMPLETED' THEN UTC_TIMESTAMP() ELSE completed_at END,
             cancelled_at = CASE WHEN ? = 'CANCELLED' THEN UTC_TIMESTAMP() ELSE cancelled_at END
         WHERE id = ?`,
        [params.newStatus, params.newStatus, params.newStatus, params.newStatus, params.newStatus, params.applicationId]
      );

      // 2. Insert status history entry
      await conn.query(
        `INSERT INTO application_status_history (application_id, old_status, new_status, changed_by, reason)
         VALUES (?, ?, ?, ?, ?)`,
        [params.applicationId, params.oldStatus, params.newStatus, params.changedBy, params.reason || null]
      );
    });
  }

  static async assignConsultant(params: {
    applicationId: number;
    consultantId: number;
    assignedBy: number;
    notes?: string | null;
  }): Promise<void> {
    return withTransaction(async (conn) => {
      // 1. Mark previous assignments as COMPLETED
      await conn.query(
        `UPDATE application_assignments
         SET status = 'COMPLETED', unassigned_at = UTC_TIMESTAMP()
         WHERE application_id = ? AND status = 'ACTIVE'`,
        [params.applicationId]
      );

      // 2. Insert new assignment
      await conn.query(
        `INSERT INTO application_assignments (application_id, consultant_id, assigned_by, notes, status)
         VALUES (?, ?, ?, ?, 'ACTIVE')`,
        [params.applicationId, params.consultantId, params.assignedBy, params.notes || null]
      );

      // 3. Update denormalized assigned_consultant_id on applications
      await conn.query(
        `UPDATE applications
         SET assigned_consultant_id = ?,
             status = CASE WHEN status IN ('SUBMITTED', 'UNDER_REVIEW') THEN 'ASSIGNED' ELSE status END
         WHERE id = ?`,
        [params.consultantId, params.applicationId]
      );
    });
  }

  static async list(params: {
    clientId?: number;
    consultantId?: number;
    status?: string;
    priority?: string;
    serviceId?: number;
    search?: string;
    limit: number;
    offset: number;
  }): Promise<{ applications: any[]; total: number }> {
    const conditions: string[] = [];
    const values: any[] = [];

    if (params.clientId) {
      conditions.push('a.client_id = ?');
      values.push(params.clientId);
    }
    if (params.consultantId) {
      conditions.push('a.assigned_consultant_id = ?');
      values.push(params.consultantId);
    }
    if (params.status) {
      conditions.push('a.status = ?');
      values.push(params.status);
    }
    if (params.priority) {
      conditions.push('a.priority = ?');
      values.push(params.priority);
    }
    if (params.serviceId) {
      conditions.push('a.service_id = ?');
      values.push(params.serviceId);
    }
    if (params.search) {
      conditions.push('(a.application_number LIKE ? OR a.title LIKE ? OR c.legal_name LIKE ?)');
      const term = `%${params.search}%`;
      values.push(term, term, term);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total
       FROM applications a
       INNER JOIN clients c ON c.id = a.client_id
       ${whereClause}`,
      values
    );
    const total = countRows[0]?.['total'] || 0;

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT a.id, a.public_id, a.application_number, a.title, a.status, a.priority,
              a.quoted_amount, a.final_amount, a.currency, a.submitted_at, a.completed_at, a.created_at,
              c.public_id AS client_public_id, c.legal_name AS client_name,
              s.name AS service_name, s.slug AS service_slug,
              u.first_name AS consultant_first_name, u.last_name AS consultant_last_name
       FROM applications a
       INNER JOIN clients c ON c.id = a.client_id
       INNER JOIN services s ON s.id = a.service_id
       LEFT  JOIN users u ON u.id = a.assigned_consultant_id
       ${whereClause}
       ORDER BY a.created_at DESC
       LIMIT ? OFFSET ?`,
      [...values, params.limit, params.offset]
    );

    return { applications: rows, total };
  }

  static async getStatusHistory(applicationId: number): Promise<RowDataPacket[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT ash.id, ash.old_status, ash.new_status, ash.reason, ash.created_at,
              u.first_name AS changed_by_first_name, u.last_name AS changed_by_last_name
       FROM application_status_history ash
       LEFT JOIN users u ON u.id = ash.changed_by
       WHERE ash.application_id = ?
       ORDER BY ash.created_at ASC`,
      [applicationId]
    );
    return rows;
  }
}
