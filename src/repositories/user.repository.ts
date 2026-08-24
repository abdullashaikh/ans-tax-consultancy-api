import { pool, RowDataPacket, ResultSetHeader } from '../config/database';
import { UserRecord, UserStatus } from '../types/models';
import { RoleName } from '../constants/roles';
import { PermissionName } from '../constants/permissions';

export class UserRepository {
  static async findById(id: number): Promise<UserRecord | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, public_id, first_name, last_name, email, phone, status,
              email_verified_at, phone_verified_at, last_login_at, created_at, updated_at, deleted_at
       FROM users
       WHERE id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [id]
    );
    return (rows[0] as UserRecord) || null;
  }

  static async findByPublicId(publicId: string): Promise<UserRecord | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, public_id, first_name, last_name, email, phone, status,
              email_verified_at, phone_verified_at, last_login_at, created_at, updated_at, deleted_at
       FROM users
       WHERE public_id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [publicId]
    );
    return (rows[0] as UserRecord) || null;
  }

  static async findByEmail(email: string): Promise<(UserRecord & { password_hash: string }) | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, public_id, first_name, last_name, email, phone, password_hash, status,
              email_verified_at, phone_verified_at, last_login_at, created_at, updated_at, deleted_at
       FROM users
       WHERE email = ? AND deleted_at IS NULL
       LIMIT 1`,
      [email.toLowerCase()]
    );
    return (rows[0] as UserRecord & { password_hash: string }) || null;
  }

  static async create(params: {
    publicId: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string | null;
    passwordHash: string;
    status?: UserStatus;
  }): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO users (public_id, first_name, last_name, email, phone, password_hash, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        params.publicId,
        params.firstName,
        params.lastName,
        params.email.toLowerCase(),
        params.phone || null,
        params.passwordHash,
        params.status || 'ACTIVE',
      ]
    );
    return result.insertId;
  }

  static async update(
    id: number,
    params: {
      firstName?: string;
      lastName?: string;
      phone?: string | null;
      status?: UserStatus;
    }
  ): Promise<void> {
    const updates: string[] = [];
    const values: any[] = [];

    if (params.firstName !== undefined) {
      updates.push('first_name = ?');
      values.push(params.firstName);
    }
    if (params.lastName !== undefined) {
      updates.push('last_name = ?');
      values.push(params.lastName);
    }
    if (params.phone !== undefined) {
      updates.push('phone = ?');
      values.push(params.phone);
    }
    if (params.status !== undefined) {
      updates.push('status = ?');
      values.push(params.status);
    }

    if (updates.length === 0) return;

    values.push(id);
    await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
      values
    );
  }

  static async updatePassword(id: number, passwordHash: string): Promise<void> {
    await pool.query(
      `UPDATE users SET password_hash = ? WHERE id = ? AND deleted_at IS NULL`,
      [passwordHash, id]
    );
  }

  static async updateLastLogin(id: number): Promise<void> {
    await pool.query(`UPDATE users SET last_login_at = UTC_TIMESTAMP() WHERE id = ?`, [id]);
  }

  static async softDelete(id: number): Promise<void> {
    await pool.query(
      `UPDATE users SET status = 'DELETED', deleted_at = UTC_TIMESTAMP() WHERE id = ?`,
      [id]
    );
  }

  static async getUserRoles(userId: number): Promise<RoleName[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT r.name
       FROM user_roles ur
       INNER JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = ?`,
      [userId]
    );
    return rows.map((r) => r['name'] as RoleName);
  }

  static async getUserPermissions(userId: number): Promise<PermissionName[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT DISTINCT p.name
       FROM user_roles ur
       INNER JOIN role_permissions rp ON rp.role_id = ur.role_id
       INNER JOIN permissions p ON p.id = rp.permission_id
       WHERE ur.user_id = ?`,
      [userId]
    );
    return rows.map((r) => r['name'] as PermissionName);
  }

  static async assignRole(userId: number, roleName: RoleName, assignedBy?: number): Promise<void> {
    await pool.query(
      `INSERT IGNORE INTO user_roles (user_id, role_id, assigned_by)
       SELECT ?, id, ? FROM roles WHERE name = ? LIMIT 1`,
      [userId, assignedBy || null, roleName]
    );
  }

  static async removeRole(userId: number, roleName: RoleName): Promise<void> {
    await pool.query(
      `DELETE ur FROM user_roles ur
       INNER JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = ? AND r.name = ?`,
      [userId, roleName]
    );
  }

  static async list(params: {
    status?: string;
    search?: string;
    limit: number;
    offset: number;
  }): Promise<{ users: UserRecord[]; total: number }> {
    const conditions: string[] = ['u.deleted_at IS NULL'];
    const values: any[] = [];

    if (params.status) {
      conditions.push('u.status = ?');
      values.push(params.status);
    }
    if (params.search) {
      conditions.push('(u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)');
      const term = `%${params.search}%`;
      values.push(term, term, term, term);
    }

    const whereClause = conditions.join(' AND ');

    // 1. Get total count
    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM users u WHERE ${whereClause}`,
      values
    );
    const total = countRows[0]?.['total'] || 0;

    // 2. Get paginated results
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT u.id, u.public_id, u.first_name, u.last_name, u.email, u.phone, u.status,
              u.email_verified_at, u.last_login_at, u.created_at, u.updated_at
       FROM users u
       WHERE ${whereClause}
       ORDER BY u.created_at DESC
       LIMIT ? OFFSET ?`,
      [...values, params.limit, params.offset]
    );

    return { users: rows as UserRecord[], total };
  }
}
