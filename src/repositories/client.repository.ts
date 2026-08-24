import { pool, RowDataPacket, ResultSetHeader } from '../config/database';
import { ClientRecord, ClientStatus, ClientType, AddressType } from '../types/models';

export class ClientRepository {
  static async findById(id: number): Promise<ClientRecord | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, public_id, user_id, client_type, legal_name, display_name, email, phone,
              alternate_phone, business_type, gstin, pan_reference, status, created_at, updated_at, deleted_at
       FROM clients
       WHERE id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [id]
    );
    return (rows[0] as ClientRecord) || null;
  }

  static async findByPublicId(publicId: string): Promise<ClientRecord | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, public_id, user_id, client_type, legal_name, display_name, email, phone,
              alternate_phone, business_type, gstin, pan_reference, status, created_at, updated_at, deleted_at
       FROM clients
       WHERE public_id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [publicId]
    );
    return (rows[0] as ClientRecord) || null;
  }

  static async findByUserId(userId: number): Promise<ClientRecord | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, public_id, user_id, client_type, legal_name, display_name, email, phone,
              alternate_phone, business_type, gstin, pan_reference, status, created_at, updated_at, deleted_at
       FROM clients
       WHERE user_id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [userId]
    );
    return (rows[0] as ClientRecord) || null;
  }

  static async create(params: {
    publicId: string;
    userId: number;
    clientType: ClientType;
    legalName: string;
    displayName?: string | null;
    email?: string | null;
    phone?: string | null;
    alternatePhone?: string | null;
    businessType?: string | null;
    gstin?: string | null;
    panReference?: string | null;
    status?: ClientStatus;
  }): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO clients (
        public_id, user_id, client_type, legal_name, display_name, email, phone,
        alternate_phone, business_type, gstin, pan_reference, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        params.publicId,
        params.userId,
        params.clientType,
        params.legalName,
        params.displayName || null,
        params.email || null,
        params.phone || null,
        params.alternatePhone || null,
        params.businessType || null,
        params.gstin || null,
        params.panReference || null,
        params.status || 'ACTIVE',
      ]
    );
    return result.insertId;
  }

  static async update(
    id: number,
    params: {
      legalName?: string;
      displayName?: string | null;
      email?: string | null;
      phone?: string | null;
      alternatePhone?: string | null;
      businessType?: string | null;
      gstin?: string | null;
      panReference?: string | null;
      status?: ClientStatus;
    }
  ): Promise<void> {
    const updates: string[] = [];
    const values: any[] = [];

    if (params.legalName !== undefined) {
      updates.push('legal_name = ?');
      values.push(params.legalName);
    }
    if (params.displayName !== undefined) {
      updates.push('display_name = ?');
      values.push(params.displayName);
    }
    if (params.email !== undefined) {
      updates.push('email = ?');
      values.push(params.email);
    }
    if (params.phone !== undefined) {
      updates.push('phone = ?');
      values.push(params.phone);
    }
    if (params.alternatePhone !== undefined) {
      updates.push('alternate_phone = ?');
      values.push(params.alternatePhone);
    }
    if (params.businessType !== undefined) {
      updates.push('business_type = ?');
      values.push(params.businessType);
    }
    if (params.gstin !== undefined) {
      updates.push('gstin = ?');
      values.push(params.gstin);
    }
    if (params.panReference !== undefined) {
      updates.push('pan_reference = ?');
      values.push(params.panReference);
    }
    if (params.status !== undefined) {
      updates.push('status = ?');
      values.push(params.status);
    }

    if (updates.length === 0) return;

    values.push(id);
    await pool.query(`UPDATE clients SET ${updates.join(', ')} WHERE id = ? AND deleted_at IS NULL`, values);
  }

  static async addAddress(params: {
    clientId: number;
    addressType: AddressType;
    addressLine1: string;
    addressLine2?: string | null;
    city: string;
    state: string;
    country: string;
    postalCode: string;
    isPrimary?: boolean;
  }): Promise<number> {
    if (params.isPrimary) {
      await pool.query(`UPDATE client_addresses SET is_primary = 0 WHERE client_id = ?`, [params.clientId]);
    }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO client_addresses (
        client_id, address_type, address_line_1, address_line_2, city, state, country, postal_code, is_primary
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        params.clientId,
        params.addressType,
        params.addressLine1,
        params.addressLine2 || null,
        params.city,
        params.state,
        params.country,
        params.postalCode,
        params.isPrimary ? 1 : 0,
      ]
    );
    return result.insertId;
  }

  static async getAddresses(clientId: number): Promise<RowDataPacket[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, address_type, address_line_1, address_line_2, city, state, country, postal_code, is_primary, created_at
       FROM client_addresses
       WHERE client_id = ?
       ORDER BY is_primary DESC, created_at DESC`,
      [clientId]
    );
    return rows;
  }

  static async list(params: {
    clientType?: string;
    status?: string;
    search?: string;
    limit: number;
    offset: number;
  }): Promise<{ clients: ClientRecord[]; total: number }> {
    const conditions: string[] = ['c.deleted_at IS NULL'];
    const values: any[] = [];

    if (params.clientType) {
      conditions.push('c.client_type = ?');
      values.push(params.clientType);
    }
    if (params.status) {
      conditions.push('c.status = ?');
      values.push(params.status);
    }
    if (params.search) {
      conditions.push('(c.legal_name LIKE ? OR c.display_name LIKE ? OR c.email LIKE ? OR c.phone LIKE ? OR c.gstin LIKE ?)');
      const term = `%${params.search}%`;
      values.push(term, term, term, term, term);
    }

    const whereClause = conditions.join(' AND ');

    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM clients c WHERE ${whereClause}`,
      values
    );
    const total = countRows[0]?.['total'] || 0;

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT c.id, c.public_id, c.user_id, c.client_type, c.legal_name, c.display_name,
              c.email, c.phone, c.business_type, c.gstin, c.pan_reference, c.status, c.created_at, c.updated_at,
              u.first_name AS user_first_name, u.last_name AS user_last_name
       FROM clients c
       INNER JOIN users u ON u.id = c.user_id
       WHERE ${whereClause}
       ORDER BY c.created_at DESC
       LIMIT ? OFFSET ?`,
      [...values, params.limit, params.offset]
    );

    return { clients: rows as ClientRecord[], total };
  }
}
