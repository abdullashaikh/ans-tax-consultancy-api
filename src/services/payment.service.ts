import Razorpay from 'razorpay';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { PaymentRepository } from '../repositories/payment.repository';
import { ApplicationRepository } from '../repositories/application.repository';
import { ClientRepository } from '../repositories/client.repository';
import { UserRepository } from '../repositories/user.repository';
import { ApiError } from '../utils/apiError';
import { PaymentStatus } from '../types/models';
import { AuditService } from '../middleware/audit.middleware';
import { CryptoUtil } from '../utils/crypto';
import { env } from '../config/env';
import { pool } from '../config/database';
import { logger } from '../config/logger';
import { RowDataPacket } from 'mysql2/promise';

export class PaymentService {
  private static razorpayInstance: Razorpay | null = null;

  /**
   * Initializes or returns the singleton Razorpay instance.
   */
  private static getRazorpayClient(): { instance: Razorpay; keyId: string; keySecret: string } {
    const keyId = (env.RAZORPAY_KEY_ID || env.PAYMENT_KEY_ID || process.env['RAZORPAY_KEY_ID'] || '').trim();
    const keySecret = (env.RAZORPAY_KEY_SECRET || env.PAYMENT_KEY_SECRET || process.env['RAZORPAY_KEY_SECRET'] || '').trim();

    if (!keyId || !keySecret) {
      logger.error('[PaymentService] Razorpay Key ID or Key Secret is missing in environment.');
      throw ApiError.internal('Payment gateway is not properly configured. Missing Razorpay credentials.');
    }

    if (!this.razorpayInstance) {
      this.razorpayInstance = new Razorpay({
        key_id: keyId,
        key_secret: keySecret,
      });
    }

    return { instance: this.razorpayInstance, keyId, keySecret };
  }

  /**
   * Generates a sequential, collision-free payment reference number in format PAY-YYYYMM-NNNNN.
   */
  private static async generatePaymentRef(): Promise<string> {
    const prefix = `PAY-${new Date().toISOString().slice(0, 7).replace('-', '')}-`;
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT MAX(CAST(SUBSTRING_INDEX(payment_reference, '-', -1) AS UNSIGNED)) AS max_num
       FROM payments
       WHERE payment_reference LIKE ?`,
      [`${prefix}%`]
    );

    let nextNumber = 1;
    if (rows.length > 0 && rows[0]?.['max_num'] !== null && rows[0]?.['max_num'] !== undefined) {
      nextNumber = Number(rows[0]['max_num']) + 1;
    }

    let candidate = `${prefix}${String(nextNumber).padStart(5, '0')}`;

    // Safety loop to ensure uniqueness against concurrent inserts
    let attempts = 0;
    while (attempts < 5) {
      const [existing] = await pool.query<RowDataPacket[]>(
        `SELECT id FROM payments WHERE payment_reference = ? LIMIT 1`,
        [candidate]
      );
      if (existing.length === 0) {
        break;
      }
      nextNumber += 1;
      candidate = `${prefix}${String(nextNumber).padStart(5, '0')}`;
      attempts += 1;
    }

    return candidate;
  }

  /**
   * Creates a Razorpay Standard Checkout Order.
   * Minimum order amount: 100 paise (₹1).
   */
  static async createOrder(params: {
    amount: number;
    currency?: string;
    applicationId?: number;
    userId?: number;
    receipt?: string;
    notes?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{
    order_id: string;
    id: string;
    amount: number;
    currency: string;
    key_id: string;
    receipt: string;
    paymentReference: string;
  }> {
    const { instance: razorpay, keyId } = this.getRazorpayClient();

    // 1. Calculate amount in Paise (Razorpay expects amounts in Paise: 1 INR = 100 paise)
    // The amount parameter is always provided in Rupees (INR).
    // Minimum Razorpay amount is ₹1 (100 paise).
    const amountInRupees = Number(params.amount);
    if (isNaN(amountInRupees) || amountInRupees < 1) {
      throw ApiError.badRequest('Minimum payment amount is 100 paise (₹1).');
    }
    const amountInPaise = Math.round(amountInRupees * 100);

    const currency = (params.currency || 'INR').toUpperCase();
    const paymentRef = params.receipt || (await this.generatePaymentRef());

    // 2. Resolve client and application if provided
    let clientId: number | null = null;
    let applicationId: number | null = null;

    if (params.userId) {
      const client = await ClientRepository.findByUserId(params.userId);
      if (client) {
        clientId = client.id;
      } else {
        // Auto-provision client profile for this user if missing
        const userRec = await UserRepository.findById(params.userId);
        if (userRec) {
          const newClientId = await ClientRepository.create({
            publicId: uuidv4(),
            userId: userRec.id,
            clientType: 'INDIVIDUAL',
            legalName: `${userRec.first_name || ''} ${userRec.last_name || ''}`.trim() || userRec.email,
            email: userRec.email,
            phone: userRec.phone,
            status: 'ACTIVE',
          });
          clientId = newClientId;
        }
      }
    }

    if (params.applicationId) {
      const app = await ApplicationRepository.findById(params.applicationId);
      if (app) {
        applicationId = app.id;
        if (!clientId) clientId = app.client_id;
      }
    } else if (clientId) {
      // If no applicationId was explicitly passed, check if client has an existing application
      const clientApps = await ApplicationRepository.list({ clientId, limit: 1, offset: 0 });
      if (clientApps.applications && clientApps.applications.length > 0) {
        applicationId = clientApps.applications[0].id;
      }
    }

    // 3. Create order via Razorpay API
    let razorpayOrder: any;
    try {
      razorpayOrder = await razorpay.orders.create({
        amount: amountInPaise,
        currency,
        receipt: paymentRef,
        notes: {
          payment_reference: paymentRef,
          application_id: String(applicationId || ''),
          user_id: String(params.userId || ''),
          ...params.notes,
        },
      });
    } catch (err: any) {
      logger.error('[PaymentService] Razorpay order creation failed:', {
        error: err.message,
        details: err.error,
      });
      throw ApiError.internal(`Failed to create Razorpay payment order: ${err.message || 'Gateway error'}`);
    }

    // 4. Save or update payment record in MySQL if client is resolved
    if (clientId) {
      // Check if a payment record with this paymentReference already exists (e.g. paying existing invoice)
      const existingPayment = await PaymentRepository.findByReference(paymentRef);
      if (existingPayment) {
        await pool.query(
          `UPDATE payments 
           SET gateway_transaction_id = ?,
               amount = ?,
               currency = ?,
               payment_gateway = 'RAZORPAY',
               updated_at = UTC_TIMESTAMP()
           WHERE id = ?`,
          [razorpayOrder.id, amountInRupees, currency, existingPayment.id]
        );
      } else {
        const publicId = uuidv4();

        await PaymentRepository.create({
          publicId,
          clientId,
          applicationId: applicationId || null,
          paymentReference: paymentRef,
          amount: amountInRupees,
          currency,
          paymentGateway: 'RAZORPAY',
          gatewayTransactionId: razorpayOrder.id, // Store razorpay order_id so verifyPayment can find it!
          paymentMethod: null,
        });
      }
    }

    // 5. Audit trail
    await AuditService.log({
      userId: params.userId || null,
      action: 'PAYMENT_ORDER_CREATED',
      entityType: 'PAYMENT',
      newValues: {
        orderId: razorpayOrder.id,
        amount: amountInPaise,
        currency,
        receipt: paymentRef,
      },
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    return {
      order_id: razorpayOrder.id,
      id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      key_id: keyId,
      receipt: razorpayOrder.receipt,
      paymentReference: paymentRef,
    };
  }

  /**
   * Verifies Razorpay Web Checkout payment signature:
   * HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET) === signature
   */
  static async verifyPayment(params: {
    razorpay_order_id?: string;
    order_id?: string;
    razorpay_payment_id?: string;
    payment_id?: string;
    razorpay_signature?: string;
    signature?: string;
    userId?: number;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{
    verified: boolean;
    order_id: string;
    payment_id: string;
    message: string;
    invoice?: any;
  }> {
    const orderId = (params.razorpay_order_id || params.order_id || '').trim();
    const paymentId = (params.razorpay_payment_id || params.payment_id || '').trim();
    const clientSignature = (params.razorpay_signature || params.signature || '').trim();

    if (!orderId || !paymentId || !clientSignature) {
      throw ApiError.badRequest(
        'Missing required payment verification parameters: razorpay_order_id, razorpay_payment_id, and razorpay_signature are required.'
      );
    }

    const { keySecret } = this.getRazorpayClient();

    // Generate expected HMAC-SHA256 signature
    const generatedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    // Secure timing-safe signature comparison
    let isSignatureValid = false;
    if (generatedSignature.length === clientSignature.length) {
      try {
        isSignatureValid = crypto.timingSafeEqual(
          Buffer.from(generatedSignature, 'utf-8'),
          Buffer.from(clientSignature, 'utf-8')
        );
      } catch {
        isSignatureValid = false;
      }
    }

    if (!isSignatureValid) {
      logger.warn('[PaymentService] Razorpay signature mismatch', {
        orderId,
        paymentId,
      });

      await AuditService.log({
        userId: params.userId || null,
        action: 'PAYMENT_VERIFICATION_FAILED',
        entityType: 'PAYMENT',
        newValues: { orderId, paymentId },
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      });

      throw ApiError.badRequest('Payment verification failed. Invalid signature.');
    }

    // Update payment record in database
    let payment = await PaymentRepository.findByGatewayTransactionId(orderId);
    if (!payment && (params.razorpay_order_id || params.order_id)) {
      payment = await PaymentRepository.findByGatewayTransactionId(params.razorpay_order_id || params.order_id || '');
    }

    if (payment) {
      await PaymentRepository.updateStatus({
        id: payment.id,
        status: 'SUCCESS',
        gatewayTransactionId: paymentId,
        paymentMethod: 'RAZORPAY',
      });

      // If linked application was PAYMENT_PENDING or DRAFT, transition application status
      if (payment.application_id) {
        await pool.query(
          `UPDATE applications
           SET status = CASE
             WHEN status = 'PAYMENT_PENDING' THEN 'IN_PROGRESS'
             WHEN status = 'DRAFT' THEN 'SUBMITTED'
             ELSE status
           END,
           updated_at = UTC_TIMESTAMP()
           WHERE id = ?`,
          [payment.application_id]
        );
      }
    }

    // Build enriched invoice details for client receipt
    let invoiceDetails: any = null;
    if (payment) {
      const refreshedPayment = await PaymentRepository.findById(payment.id);
      let clientInfo: any = null;
      if (refreshedPayment?.client_id) {
        clientInfo = await ClientRepository.findById(refreshedPayment.client_id);
      }

      const totalAmount = Number(refreshedPayment?.amount || 0);
      const taxableAmount = Math.round((totalAmount / 1.18) * 100) / 100;
      const gstAmount = Math.round((totalAmount - taxableAmount) * 100) / 100;

      invoiceDetails = {
        id: refreshedPayment?.id,
        invoiceNumber: refreshedPayment?.payment_reference || `INV-${orderId.slice(-6).toUpperCase()}`,
        paymentReference: refreshedPayment?.payment_reference,
        amount: totalAmount,
        taxableAmount,
        cgst: Math.round((gstAmount / 2) * 100) / 100,
        sgst: Math.round((gstAmount / 2) * 100) / 100,
        gstRate: 18,
        currency: refreshedPayment?.currency || 'INR',
        status: 'SUCCESS',
        paymentGateway: 'RAZORPAY',
        gatewayTransactionId: paymentId,
        orderId,
        paymentMethod: 'RAZORPAY',
        paidAt: refreshedPayment?.paid_at || new Date(),
        createdAt: refreshedPayment?.created_at || new Date(),
        client: clientInfo ? {
          name: clientInfo.legal_name || clientInfo.display_name,
          email: clientInfo.email,
          phone: clientInfo.phone,
          gstin: clientInfo.gstin,
          pan: clientInfo.pan_reference,
        } : null,
      };
    }

    // Audit log successful verification
    await AuditService.log({
      userId: params.userId || null,
      action: 'PAYMENT_VERIFIED_SUCCESS',
      entityType: 'PAYMENT',
      newValues: { orderId, paymentId, status: 'SUCCESS' },
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    return {
      verified: true,
      order_id: orderId,
      payment_id: paymentId,
      invoice: invoiceDetails,
      message: 'Payment verified and processed successfully',
    };
  }

  /**
   * Backward-compatible payment creation.
   */
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
    const order = await this.createOrder({
      amount: params.amount,
      currency: params.currency || 'INR',
      applicationId: params.applicationId,
      userId: params.userId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    return order;
  }

  /**
   * Handles incoming Razorpay Webhooks.
   */
  static async handleWebhook(params: {
    signature?: string;
    rawBody: string;
    payload: any;
    ipAddress?: string;
  }) {
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

    const event = params.payload?.event;
    const paymentEntity = params.payload?.payload?.payment?.entity;

    if (paymentEntity?.notes?.payment_reference) {
      const paymentRef = paymentEntity.notes.payment_reference;
      const payment = await PaymentRepository.findByReference(paymentRef);

      if (payment) {
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
