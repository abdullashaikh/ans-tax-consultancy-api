import { Request, Response, NextFunction } from 'express';
import { AppointmentService } from '../services/appointment.service';
import { ResponseFormatter } from '../utils/apiResponse';
import { PaginationUtil } from '../utils/pagination';
import { RoleName } from '../constants/roles';

export class AppointmentController {
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const appt = await AppointmentService.createAppointment({
        userId: req.user!.id,
        ...req.body,
      });
      ResponseFormatter.created(res, appt, 'Appointment requested successfully');
    } catch (error) {
      next(error);
    }
  }

  static async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const appt = await AppointmentService.updateStatus(
        req.params['id']!,
        req.body.status,
        req.user!.id
      );
      ResponseFormatter.success(res, appt, 'Appointment status updated successfully');
    } catch (error) {
      next(error);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, offset } = PaginationUtil.parseQuery(req.query);
      const user = req.user!;

      let clientId: number | undefined;
      let consultantId: number | undefined;

      if (user.roles.includes(RoleName.CLIENT)) {
        clientId = user.clientId;
      } else if (user.roles.includes(RoleName.CONSULTANT) && !user.roles.includes(RoleName.ADMIN) && !user.roles.includes(RoleName.SUPER_ADMIN)) {
        consultantId = user.id;
      }

      const fromDate = req.query['fromDate'] ? new Date(req.query['fromDate'] as string) : undefined;
      const toDate = req.query['toDate'] ? new Date(req.query['toDate'] as string) : undefined;

      const { appointments, total } = await AppointmentService.listAppointments({
        clientId,
        consultantId,
        status: req.query['status'] as string | undefined,
        fromDate,
        toDate,
        limit,
        offset,
      });

      const meta = PaginationUtil.buildMeta(page, limit, total);
      ResponseFormatter.success(res, appointments, undefined, 200, meta);
    } catch (error) {
      next(error);
    }
  }
}
