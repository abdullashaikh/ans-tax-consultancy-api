import { v4 as uuidv4 } from 'uuid';
import { PaymentRepository } from '../repositories/payment.repository';
import { ApplicationRepository } from '../repositories/application.repository';
import { ClientRepository } from '../repositories/client.repository';
import { ApiError } from '../utils/apiError';
import { ErrorCodes } from '../constants/errorCodes';
import { PaymentStatus } from '../types/models';
import { AuditService } from '../middleware/audit.middleware';
import { CryptoUtil } from '../utils/crypto';
import { env } from '../config/env';
import { pool } from '../config/database';
import { RowDataPacket } from 'mysql2/promise';

export class PaymentService {
  /**
   * Generates a sequential payment reference number in format PAY-YYYYMM-NNNNN.
   */
  private static async generatePaymentRef(): Promise<string> {
    const prefix = `PAY-${new Date().toISOString().slice(0, 7).replace('-', '')}-`;
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT payment_reference FROM payments WHERE payment_reference LIKE ? ORDER BY id DESC LIMIT 1`,
      [`${prefix}%`]
    );

    let nextNumber = 1;
    if (rows.length > 0 && rows[0]?.['payment_reference']) {
      const lastNumberStr = (rows[0]['payment_reference'] as string).split('-')[2];
      if (lastNumberStr) {
        nextNumber = parseInt(lastNumberStr, 10) + 1;
      }
    }

    return `${prefix}${String(nextNumber).padStart(5, '0')}`;
  }

  static async createPayment(params: {
    userId: number;
    applicationId: number;
    amount: number;
    currency?: string;
    paymentGateway?: string;
    paymentMethod?: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const client = await ClientRepository.findByUserId(params.userId);
    if (!client) {
      throw ApiError.badRequest('Active client profile required to make payments');
    }

    const application = await ApplicationRepository.findById(params.applicationId);
    if (!application) {
      throw ApiError.notFound('Application not found', ErrorCodes.APPLICATION_NOT_FOUND);
    }

    const publicId = uuidv4();
    const paymentRef = await this.generatePaymentRef();

    const paymentId = await PaymentRepository.create({
      publicId,
      clientId: client.id,
      applicationId: params.applicationId,
      paymentReference: paymentRef,
      amount: params.amount,
      currency: params.currency || 'INR',
      paymentGateway: params.paymentGateway || env.PAYMENT_PROVIDER,
      paymentMethod: params.paymentMethod,
    });

    await AuditService.log({
      userId: params.userId,
      action: 'PAYMENT_CREATED',
      entityType: 'PAYMENT',
      entityId: paymentId,
      newValues: { reference: paymentRef, amount: params.amount },
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    return PaymentRepository.findByPublicId(publicId);
  }

  static async handleWebhook(params: {
    signature?: string;
    rawBody: string;
    payload: any;
    ipAddress?: string;
  }) {
    // 1. Verify webhook signature if secret is configured
    if (env.PAYMENT_WEBHOOK_SECRET && params.signature) {
      const isValid = CryptoUtil.verifyHmacSignature(
        params.rawBody,
        params.signature,
        env.PAYMENT_WEBHOOK_SECRET
      );
      if (!isValid) {
        throw ApiError.unauthorized('Invalid webhook signature');
      }
    }

    // 2. Extract payment reference and status (e.g. Razorpay payment.captured or payment.failed)
    const event = params.payload?.event;
    const paymentEntity = params.payload?.payload?.payment?.entity;

    if (paymentEntity?.notes?.payment_reference) {
      const paymentRef = paymentEntity.notes.payment_reference;
      const payment = await PaymentRepository.findByReference(paymentRef);

      if (payment) {
        // Idempotency check: if already successful, skip
        if (payment.status === 'SUCCESS') {
          return { status: 'already_processed' };
        }

        const newStatus: PaymentStatus = event === 'payment.captured' ? 'SUCCESS' : 'FAILED';
        await PaymentRepository.updateStatus({
          id: payment.id,
          status: newStatus,
          gatewayTransactionId: paymentEntity.id,
          paymentMethod: paymentEntity.method,
        });

        await AuditService.log({
          action: `PAYMENT_WEBHOOK_${newStatus}`,
          entityType: 'PAYMENT',
          entityId: payment.id,
          newValues: { gatewayId: paymentEntity.id, status: newStatus },
          ipAddress: params.ipAddress,
        });
      }
    }

    return { received: true };
  }

  static async listPayments(params: {
    clientId?: number;
    applicationId?: number;
    status?: string;
    limit: number;
    offset: number;
  }) {
    return PaymentRepository.list(params);
  }
}
