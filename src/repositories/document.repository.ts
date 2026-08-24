import { pool, RowDataPacket, ResultSetHeader } from '../config/database';
import { DocumentRecord, DocumentStatus } from '../types/models';

export class DocumentRepository {
  static async findById(id: number): Promise<DocumentRecord | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM documents WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      [id]
    );
    return (rows[0] as DocumentRecord) || null;
  }

  static async findByPublicId(publicId: string): Promise<(DocumentRecord & {
    document_type_name: string;
    document_type_code: string;
    client_name: string;
  }) | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT d.*, dt.name AS document_type_name, dt.code AS document_type_code, c.legal_name AS client_name
       FROM documents d
       INNER JOIN document_types dt ON dt.id = d.document_type_id
       INNER JOIN clients c ON c.id = d.client_id
       WHERE d.public_id = ? AND d.deleted_at IS NULL
       LIMIT 1`,
      [publicId]
    );
    return (rows[0] as any) || null;
  }

  static async register(params: {
    publicId: string;
    clientId: number;
    applicationId?: number | null;
    documentTypeId: number;
    originalFileName: string;
    storageProvider: string;
    storageObjectKey: string;
    mimeType: string;
    fileSize: number;
    checksum?: string | null;
    uploadedBy: number;
  }): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO documents (
        public_id, client_id, application_id, document_type_id,
        original_file_name, storage_provider, storage_object_key,
        mime_type, file_size, checksum, uploaded_by, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'UPLOADED')`,
      [
        params.publicId,
        params.clientId,
        params.applicationId || null,
        params.documentTypeId,
        params.originalFileName,
        params.storageProvider,
        params.storageObjectKey,
        params.mimeType,
        params.fileSize,
        params.checksum || null,
        params.uploadedBy,
      ]
    );
    return result.insertId;
  }

  static async updateStatus(id: number, status: DocumentStatus): Promise<void> {
    await pool.query(
      `UPDATE documents SET status = ? WHERE id = ? AND deleted_at IS NULL`,
      [status, id]
    );
  }

  static async softDelete(id: number): Promise<void> {
    await pool.query(
      `UPDATE documents SET deleted_at = UTC_TIMESTAMP() WHERE id = ?`,
      [id]
    );
  }

  static async listByClient(clientId: number): Promise<RowDataPacket[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT d.id, d.public_id, d.original_file_name, d.mime_type, d.file_size,
              d.version, d.status, d.uploaded_at, d.expires_at,
              dt.name AS document_type_name, dt.code AS document_type_code,
              u.first_name AS uploaded_by_first_name, u.last_name AS uploaded_by_last_name
       FROM documents d
       INNER JOIN document_types dt ON dt.id = d.document_type_id
       INNER JOIN users u ON u.id = d.uploaded_by
       WHERE d.client_id = ? AND d.deleted_at IS NULL
       ORDER BY d.uploaded_at DESC`,
      [clientId]
    );
    return rows;
  }

  static async listByApplication(applicationId: number): Promise<RowDataPacket[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT d.id, d.public_id, d.original_file_name, d.mime_type, d.file_size,
              d.version, d.status, d.uploaded_at,
              dt.name AS document_type_name, dt.code AS document_type_code,
              u.first_name AS uploaded_by_first_name, u.last_name AS uploaded_by_last_name
       FROM documents d
       INNER JOIN document_types dt ON dt.id = d.document_type_id
       INNER JOIN users u ON u.id = d.uploaded_by
       WHERE d.application_id = ? AND d.deleted_at IS NULL
       ORDER BY d.uploaded_at DESC`,
      [applicationId]
    );
    return rows;
  }

  static async listDocumentTypes(): Promise<RowDataPacket[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, name, code, description, is_required, is_active FROM document_types WHERE is_active = 1 ORDER BY name ASC`
    );
    return rows;
  }

  static async list(params: {
    status?: string;
    clientId?: number;
    search?: string;
    limit: number;
    offset: number;
  }): Promise<{ documents: RowDataPacket[]; total: number }> {
    let sql = `
      SELECT d.id, d.public_id, d.original_file_name, d.mime_type, d.file_size,
             d.status, d.uploaded_at, d.created_at,
             dt.name AS document_type_name, dt.code AS document_type_code,
             c.id AS client_id, c.legal_name AS client_name, c.public_id AS client_public_id,
             u.first_name AS uploaded_by_first_name, u.last_name AS uploaded_by_last_name
      FROM documents d
      INNER JOIN document_types dt ON dt.id = d.document_type_id
      INNER JOIN clients c ON c.id = d.client_id
      INNER JOIN users u ON u.id = d.uploaded_by
      WHERE d.deleted_at IS NULL
    `;
    const values: any[] = [];

    if (params.status) {
      sql += ` AND d.status = ?`;
      values.push(params.status);
    }
    if (params.clientId) {
      sql += ` AND d.client_id = ?`;
      values.push(params.clientId);
    }
    if (params.search) {
      sql += ` AND (d.original_file_name LIKE ? OR c.legal_name LIKE ? OR dt.name LIKE ?)`;
      const s = `%${params.search}%`;
      values.push(s, s, s);
    }

    const countSql = `SELECT COUNT(*) AS total FROM (${sql}) AS counted`;
    const [countRows] = await pool.query<RowDataPacket[]>(countSql, values);
    const total = Number(countRows[0]?.['total'] || 0);

    sql += ` ORDER BY d.id DESC LIMIT ? OFFSET ?`;
    values.push(params.limit, params.offset);

    const [rows] = await pool.query<RowDataPacket[]>(sql, values);
    return { documents: rows, total };
  }
}
