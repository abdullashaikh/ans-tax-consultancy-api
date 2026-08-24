import { Request, Response, NextFunction } from 'express';
import { PaymentService } from '../services/payment.service';
import { ResponseFormatter } from '../utils/apiResponse';
import { PaginationUtil } from '../utils/pagination';
import { AuditService } from '../middleware/audit.middleware';
import { RoleName } from '../constants/roles';

export class PaymentController {
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
      if (user.roles.includes(RoleName.CLIENT)) {
        clientId = user.clientId;
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
