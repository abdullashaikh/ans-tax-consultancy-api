import { pool, RowDataPacket, ResultSetHeader } from '../config/database';
import { PaymentRecord, PaymentStatus } from '../types/models';

export class PaymentRepository {
  static async findById(id: number): Promise<PaymentRecord | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM payments WHERE id = ? LIMIT 1`,
      [id]
    );
    return (rows[0] as PaymentRecord) || null;
  }

  static async findByPublicId(publicId: string): Promise<PaymentRecord | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT p.*, a.application_number, a.title AS application_title, c.legal_name AS client_name
       FROM payments p
       INNER JOIN applications a ON a.id = p.application_id
       INNER JOIN clients c ON c.id = p.client_id
       WHERE p.public_id = ?
       LIMIT 1`,
      [publicId]
    );
    return (rows[0] as PaymentRecord) || null;
  }

  static async findByReference(paymentReference: string): Promise<PaymentRecord | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM payments WHERE payment_reference = ? LIMIT 1`,
      [paymentReference]
    );
    return (rows[0] as PaymentRecord) || null;
  }

  static async findByGatewayTransactionId(gatewayTransactionId: string): Promise<PaymentRecord | null> {
    if (!pool || typeof pool.query !== 'function') return null;
    try {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT * FROM payments WHERE gateway_transaction_id = ? OR payment_reference = ? LIMIT 1`,
        [gatewayTransactionId, gatewayTransactionId]
      );
      return (rows[0] as PaymentRecord) || null;
    } catch {
      return null;
    }
  }

  static async create(params: {
    publicId: string;
    clientId: number;
    applicationId?: number | null;
    paymentReference: string;
    amount: number;
    currency?: string;
    paymentGateway?: string | null;
    gatewayTransactionId?: string | null;
    paymentMethod?: string | null;
  }): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO payments (
        public_id, client_id, application_id, payment_reference, amount, currency,
        payment_gateway, gateway_transaction_id, payment_method, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'CREATED')`,
      [
        params.publicId,
        params.clientId,
        params.applicationId || null,
        params.paymentReference,
        params.amount,
        params.currency || 'INR',
        params.paymentGateway || 'RAZORPAY',
        params.gatewayTransactionId || null,
        params.paymentMethod || null,
      ]
    );
    return result.insertId;
  }

  static async updateStatus(params: {
    id: number;
    status: PaymentStatus;
    gatewayTransactionId?: string | null;
    paymentMethod?: string | null;
  }): Promise<void> {
    const updates: string[] = ['status = ?'];
    const values: any[] = [params.status];

    if (params.status === 'SUCCESS') {
      updates.push('paid_at = UTC_TIMESTAMP()');
    }
    if (params.gatewayTransactionId !== undefined) {
      updates.push('gateway_transaction_id = ?');
      values.push(params.gatewayTransactionId);
    }
    if (params.paymentMethod !== undefined) {
      updates.push('payment_method = ?');
      values.push(params.paymentMethod);
    }

    values.push(params.id);
    await pool.query(`UPDATE payments SET ${updates.join(', ')} WHERE id = ?`, values);
  }

  static async list(params: {
    clientId?: number;
    applicationId?: number;
    status?: string;
    limit: number;
    offset: number;
  }): Promise<{ payments: any[]; total: number }> {
    const conditions: string[] = [];
    const values: any[] = [];

    if (params.clientId) {
      conditions.push('p.client_id = ?');
      values.push(params.clientId);
    }
    if (params.applicationId) {
      conditions.push('p.application_id = ?');
      values.push(params.applicationId);
    }
    if (params.status) {
      conditions.push('p.status = ?');
      values.push(params.status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM payments p ${whereClause}`,
      values
    );
    const total = countRows[0]?.['total'] || 0;

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT p.id,
              p.public_id AS publicId,
              p.public_id,
              p.payment_reference AS paymentReference,
              p.payment_reference,
              p.payment_reference AS invoiceNumber,
              p.amount,
              p.currency,
              p.payment_gateway AS paymentGateway,
              p.payment_gateway,
              p.gateway_transaction_id AS gatewayTransactionId,
              p.gateway_transaction_id,
              p.payment_method AS paymentMethod,
              p.payment_method,
              p.status,
              p.paid_at AS paidAt,
              p.paid_at,
              p.created_at AS createdAt,
              p.created_at,
              a.application_number AS applicationNumber,
              a.application_number,
              a.title AS applicationTitle,
              a.title AS application_title,
              c.legal_name AS clientName,
              c.legal_name AS client_name,
              c.public_id AS clientPublicId,
              c.public_id AS client_public_id,
              c.email AS clientEmail,
              c.email AS client_email,
              c.phone AS clientPhone,
              c.phone AS client_phone,
              c.gstin AS clientGstin,
              c.gstin AS client_gstin,
              c.pan_reference AS clientPan,
              c.pan_reference AS client_pan
       FROM payments p
       LEFT JOIN applications a ON a.id = p.application_id
       LEFT JOIN clients c ON c.id = p.client_id
       ${whereClause}
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`,
      [...values, params.limit, params.offset]
    );

    return { payments: rows, total };
  }
}
