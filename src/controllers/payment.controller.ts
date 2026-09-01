import { Request, Response, NextFunction } from 'express';
import { PaymentService } from '../services/payment.service';
import { ResponseFormatter } from '../utils/apiResponse';
import { PaginationUtil } from '../utils/pagination';
import { AuditService } from '../middleware/audit.middleware';
import { RoleName } from '../constants/roles';
import { ClientRepository } from '../repositories/client.repository';

export class PaymentController {
  /**
   * Creates a Razorpay payment order for frontend Standard Checkout.
   */
  static async createOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ipAddress = AuditService.getClientIp(req);
      const userAgent = req.headers['user-agent'];
      const userId = req.user?.id;

      const order = await PaymentService.createOrder({
        amount: Number(req.body.amount),
        currency: req.body.currency,
        applicationId: req.body.applicationId ? parseInt(req.body.applicationId, 10) : undefined,
        userId,
        receipt: req.body.receipt,
        notes: req.body.notes,
        ipAddress,
        userAgent,
      });

      ResponseFormatter.created(res, order, 'Razorpay order created successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Verifies Razorpay payment signature after successful modal checkout.
   */
  static async verifyPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ipAddress = AuditService.getClientIp(req);
      const userAgent = req.headers['user-agent'];
      const userId = req.user?.id;

      const result = await PaymentService.verifyPayment({
        razorpay_order_id: req.body.razorpay_order_id,
        order_id: req.body.order_id,
        razorpay_payment_id: req.body.razorpay_payment_id,
        payment_id: req.body.payment_id,
        razorpay_signature: req.body.razorpay_signature,
        signature: req.body.signature,
        userId,
        ipAddress,
        userAgent,
      });

      ResponseFormatter.success(res, result, 'Payment verified successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Backward-compatible payment create handler.
   */
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ipAddress = AuditService.getClientIp(req);
      const userAgent = req.headers['user-agent'];

      const payment = await PaymentService.createPayment({
        userId: req.user!.id,
        applicationId: req.body.applicationId,
        amount: req.body.amount,
        currency: req.body.currency,
        paymentGateway: req.body.paymentGateway,
        paymentMethod: req.body.paymentMethod,
        ipAddress,
        userAgent,
      });

      ResponseFormatter.created(res, payment, 'Payment order initiated');
    } catch (error) {
      next(error);
    }
  }

  static async handleWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const signature = req.headers['x-razorpay-signature'] as string | undefined;
      const ipAddress = AuditService.getClientIp(req);
      const rawBody = (req as any).rawBody || JSON.stringify(req.body);

      const result = await PaymentService.handleWebhook({
        signature,
        rawBody,
        payload: req.body,
        ipAddress,
      });

      ResponseFormatter.success(res, result, 'Webhook processed');
    } catch (error) {
      next(error);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, offset } = PaginationUtil.parseQuery(req.query);
      const user = req.user!;

      let clientId: number | undefined;
      const isClient = user.roles.includes(RoleName.CLIENT) || !user.roles.some(r => [RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.CONSULTANT, RoleName.STAFF].includes(r));

      if (isClient) {
        clientId = user.clientId;
        if (!clientId) {
          const clientRecord = await ClientRepository.findByUserId(user.id);
          clientId = clientRecord?.id;
        }
        if (!clientId) {
          // Client has no profile or payments yet; safely return empty list
          const meta = PaginationUtil.buildMeta(page, limit, 0);
          ResponseFormatter.success(res, [], undefined, 200, meta);
          return;
        }
      } else if (req.query['clientId']) {
        clientId = parseInt(req.query['clientId'] as string, 10);
      }

      const applicationId = req.query['applicationId'] ? parseInt(req.query['applicationId'] as string, 10) : undefined;
      const status = req.query['status'] as string | undefined;

      const { payments, total } = await PaymentService.listPayments({
        clientId,
        applicationId,
        status,
        limit,
        offset,
      });

      const meta = PaginationUtil.buildMeta(page, limit, total);
      ResponseFormatter.success(res, payments, undefined, 200, meta);
    } catch (error) {
      next(error);
    }
  }
}
