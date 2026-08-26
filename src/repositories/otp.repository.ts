import { pool, RowDataPacket, ResultSetHeader } from '../config/database';
import { OtpChannel, OtpPurpose } from '../services/otp/otpProvider.interface';

export interface OtpChallengeRecord {
  id: number;
  public_id: string;
  user_id: number | null;
  channel: OtpChannel;
  purpose: OtpPurpose;
  destination_hash: string;
  destination_masked: string;
  provider: string;
  provider_request_id: string | null;
  status: 'PENDING' | 'VERIFIED' | 'EXPIRED' | 'BLOCKED' | 'CANCELLED';
  attempts: number;
  max_attempts: number;
  resend_count: number;
  last_resend_at: Date | null;
  expires_at: Date;
  verified_at: Date | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
  updated_at: Date;
}

export class OtpRepository {
  /**
   * Inserts a new OTP challenge record.
   */
  static async create(params: {
    publicId: string;
    userId?: number | null;
    channel: OtpChannel;
    purpose: OtpPurpose;
    destinationHash: string;
    destinationMasked: string;
    provider: string;
    providerRequestId?: string | null;
    maxAttempts: number;
    expiresAt: Date;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO otp_challenges (
        public_id, user_id, channel, purpose, destination_hash, destination_masked,
        provider, provider_request_id, status, attempts, max_attempts, resend_count,
        expires_at, ip_address, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 0, ?, 0, ?, ?, ?)`,
      [
        params.publicId,
        params.userId || null,
        params.channel,
        params.purpose,
        params.destinationHash,
        params.destinationMasked,
        params.provider,
        params.providerRequestId || null,
        params.maxAttempts,
        params.expiresAt,
        params.ipAddress || null,
        params.userAgent || null,
      ]
    );

    return result.insertId;
  }

  /**
   * Finds challenge by publicId UUID.
   */
  static async findByPublicId(publicId: string): Promise<OtpChallengeRecord | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM otp_challenges WHERE public_id = ? LIMIT 1`,
      [publicId]
    );

    return (rows[0] as OtpChallengeRecord) || null;
  }

  /**
   * Increments verification attempts and returns the updated count.
   */
  static async incrementAttempts(id: number): Promise<number> {
    await pool.query(
      `UPDATE otp_challenges
       SET attempts = attempts + 1,
           updated_at = UTC_TIMESTAMP()
       WHERE id = ?`,
      [id]
    );

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT attempts, max_attempts FROM otp_challenges WHERE id = ? LIMIT 1`,
      [id]
    );

    return rows[0]?.['attempts'] || 0;
  }

  /**
   * Increments resend counter and records last_resend_at timestamp.
   */
  static async incrementResends(id: number): Promise<number> {
    await pool.query(
      `UPDATE otp_challenges
       SET resend_count = resend_count + 1,
           last_resend_at = UTC_TIMESTAMP(),
           updated_at = UTC_TIMESTAMP()
       WHERE id = ?`,
      [id]
    );

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT resend_count FROM otp_challenges WHERE id = ? LIMIT 1`,
      [id]
    );

    return rows[0]?.['resend_count'] || 0;
  }

  /**
   * Marks a challenge as successfully VERIFIED.
   */
  static async markVerified(id: number): Promise<void> {
    await pool.query(
      `UPDATE otp_challenges
       SET status = 'VERIFIED',
           verified_at = UTC_TIMESTAMP(),
           updated_at = UTC_TIMESTAMP()
       WHERE id = ?`,
      [id]
    );
  }

  /**
   * Updates challenge status (e.g. BLOCKED, EXPIRED, CANCELLED).
   */
  static async markStatus(
    id: number,
    status: 'PENDING' | 'VERIFIED' | 'EXPIRED' | 'BLOCKED' | 'CANCELLED'
  ): Promise<void> {
    await pool.query(
      `UPDATE otp_challenges
       SET status = ?,
           updated_at = UTC_TIMESTAMP()
       WHERE id = ?`,
      [status, id]
    );
  }

  /**
   * Counts recent OTP requests for rate limiting per destination hash within windowMs.
   */
  static async countRecentRequests(destinationHash: string, windowSeconds: number): Promise<number> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total
       FROM otp_challenges
       WHERE destination_hash = ?
         AND created_at >= (UTC_TIMESTAMP() - INTERVAL ? SECOND)`,
      [destinationHash, windowSeconds]
    );

    return rows[0]?.['total'] || 0;
  }

  /**
   * Updates provider request ID (or code hash).
   */
  static async updateProviderRequestId(id: number, providerRequestId: string): Promise<void> {
    await pool.query(
      `UPDATE otp_challenges
       SET provider_request_id = ?,
           updated_at = UTC_TIMESTAMP()
       WHERE id = ?`,
      [providerRequestId, id]
    );
  }

  /**
   * Invalidates / cancels all other active PENDING challenges for a specific destination and purpose.
   */
  static async invalidatePreviousPending(destinationHash: string, purpose: OtpPurpose): Promise<void> {
    await pool.query(
      `UPDATE otp_challenges
       SET status = 'CANCELLED',
           updated_at = UTC_TIMESTAMP()
       WHERE destination_hash = ?
         AND purpose = ?
         AND status = 'PENDING'`,
      [destinationHash, purpose]
    );
  }
}
