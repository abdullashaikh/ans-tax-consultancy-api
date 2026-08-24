import { pool, withTransaction, RowDataPacket, ResultSetHeader } from '../config/database';

export class ConversationRepository {
  static async findById(id: number): Promise<RowDataPacket | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM conversations WHERE id = ? LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  }

  static async create(clientId: number, applicationId?: number | null, creatorUserId?: number): Promise<number> {
    return withTransaction(async (conn) => {
      const [result] = await conn.query<ResultSetHeader>(
        `INSERT INTO conversations (client_id, application_id, status) VALUES (?, ?, 'ACTIVE')`,
        [clientId, applicationId || null]
      );
      const convId = result.insertId;

      if (creatorUserId) {
        await conn.query(
          `INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)`,
          [convId, creatorUserId]
        );
      }

      return convId;
    });
  }

  static async addParticipant(conversationId: number, userId: number): Promise<void> {
    await pool.query(
      `INSERT IGNORE INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)`,
      [conversationId, userId]
    );
  }

  static async isParticipant(conversationId: number, userId: number): Promise<boolean> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ? LIMIT 1`,
      [conversationId, userId]
    );
    return rows.length > 0;
  }

  static async sendMessage(params: {
    conversationId: number;
    senderId: number;
    message: string;
    documentId?: number | null;
  }): Promise<number> {
    return withTransaction(async (conn) => {
      const [result] = await conn.query<ResultSetHeader>(
        `INSERT INTO messages (conversation_id, sender_id, message, document_id)
         VALUES (?, ?, ?, ?)`,
        [params.conversationId, params.senderId, params.message, params.documentId || null]
      );

      await conn.query(
        `UPDATE conversations SET updated_at = UTC_TIMESTAMP() WHERE id = ?`,
        [params.conversationId]
      );

      return result.insertId;
    });
  }

  static async getMessages(conversationId: number, limit: number, offset: number): Promise<RowDataPacket[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT m.id, m.message, m.created_at,
              u.public_id AS sender_public_id, u.first_name AS sender_first_name, u.last_name AS sender_last_name,
              d.public_id AS document_public_id, d.original_file_name AS document_name
       FROM messages m
       INNER JOIN users u ON u.id = m.sender_id
       LEFT  JOIN documents d ON d.id = m.document_id
       WHERE m.conversation_id = ?
       ORDER BY m.created_at ASC
       LIMIT ? OFFSET ?`,
      [conversationId, limit, offset]
    );
    return rows;
  }

  static async listByClient(clientId: number): Promise<RowDataPacket[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT cv.id, cv.status, cv.created_at, cv.updated_at,
              a.application_number, a.title AS application_title,
              (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = cv.id) AS message_count
       FROM conversations cv
       LEFT JOIN applications a ON a.id = cv.application_id
       WHERE cv.client_id = ?
       ORDER BY cv.updated_at DESC`,
      [clientId]
    );
    return rows;
  }
}
