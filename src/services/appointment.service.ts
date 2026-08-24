import { v4 as uuidv4 } from 'uuid';
import { AppointmentRepository } from '../repositories/appointment.repository';
import { ClientRepository } from '../repositories/client.repository';
import { UserRepository } from '../repositories/user.repository';
import { ApiError } from '../utils/apiError';
import { ErrorCodes } from '../constants/errorCodes';
import { AppointmentStatus, AppointmentType } from '../types/models';
import { AuditService } from '../middleware/audit.middleware';

export class AppointmentService {
  static async createAppointment(params: {
    userId: number;
    consultantId: number;
    applicationId?: number;
    appointmentType: AppointmentType;
    scheduledStart: string;
    scheduledEnd: string;
    meetingUrl?: string;
    notes?: string;
  }) {
    const client = await ClientRepository.findByUserId(params.userId);
    if (!client) {
      throw ApiError.badRequest('Client profile required to book an appointment');
    }

    const consultant = await UserRepository.findById(params.consultantId);
    if (!consultant || consultant.status !== 'ACTIVE') {
      throw ApiError.badRequest('Selected consultant is unavailable');
    }

    const publicId = uuidv4();
    const apptId = await AppointmentRepository.create({
      publicId,
      clientId: client.id,
      consultantId: params.consultantId,
      applicationId: params.applicationId,
      appointmentType: params.appointmentType,
      scheduledStart: new Date(params.scheduledStart),
      scheduledEnd: new Date(params.scheduledEnd),
      meetingUrl: params.meetingUrl,
      notes: params.notes,
    });

    await AuditService.log({
      userId: params.userId,
      action: 'APPOINTMENT_REQUESTED',
      entityType: 'APPOINTMENT',
      entityId: apptId,
      newValues: { scheduledStart: params.scheduledStart },
    });

    return AppointmentRepository.findByPublicId(publicId);
  }

  static async updateStatus(publicId: string, status: AppointmentStatus, performedByUserId: number) {
    const appt = await AppointmentRepository.findByPublicId(publicId);
    if (!appt) {
      throw ApiError.notFound('Appointment not found', ErrorCodes.APPOINTMENT_NOT_FOUND);
    }

    await AppointmentRepository.updateStatus(appt.id, status);

    await AuditService.log({
      userId: performedByUserId,
      action: 'APPOINTMENT_STATUS_CHANGE',
      entityType: 'APPOINTMENT',
      entityId: appt.id,
      newValues: { status },
    });

    return AppointmentRepository.findByPublicId(publicId);
  }

  static async listAppointments(params: {
    clientId?: number;
    consultantId?: number;
    status?: string;
    fromDate?: Date;
    toDate?: Date;
    limit: number;
    offset: number;
  }) {
    return AppointmentRepository.list(params);
  }
}
