import { v4 as uuidv4 } from 'uuid';
import { ApplicationRepository } from '../repositories/application.repository';
import { ServiceRepository } from '../repositories/service.repository';
import { ClientRepository } from '../repositories/client.repository';
import { UserRepository } from '../repositories/user.repository';
import { ApiError } from '../utils/apiError';
import { ErrorCodes } from '../constants/errorCodes';
import { ApplicationStatus, ApplicationPriority } from '../types/models';
import { AuditService } from '../middleware/audit.middleware';
import { pool } from '../config/database';
import { RowDataPacket } from 'mysql2/promise';

export class ApplicationService {
  /**
   * Generates a sequential application reference number in format ANS-YYYYMM-NNNNN.
   */
  private static async generateAppNumber(): Promise<string> {
    const prefix = `ANS-${new Date().toISOString().slice(0, 7).replace('-', '')}-`;
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT application_number FROM applications WHERE application_number LIKE ? ORDER BY id DESC LIMIT 1`,
      [`${prefix}%`]
    );

    let nextNumber = 1;
    if (rows.length > 0 && rows[0]?.['application_number']) {
      const lastNumberStr = (rows[0]['application_number'] as string).split('-')[2];
      if (lastNumberStr) {
        nextNumber = parseInt(lastNumberStr, 10) + 1;
      }
    }

    return `${prefix}${String(nextNumber).padStart(5, '0')}`;
  }

  static async createApplication(params: {
    userId: number;
    serviceId: number;
    title?: string;
    description?: string;
    notes?: string;
    financialYear?: string;
    assessmentYear?: string;
    priority?: ApplicationPriority;
    ipAddress?: string;
    userAgent?: string;
  }) {
    // 1. Verify service exists
    const service = await ServiceRepository.findServiceById(params.serviceId);
    if (!service || !service.is_active) {
      throw ApiError.badRequest('Selected service is unavailable or inactive');
    }

    // 2. Resolve client profile for user
    const client = await ClientRepository.findByUserId(params.userId);
    if (!client) {
      throw ApiError.badRequest('User does not have an active client profile');
    }

    const publicId = uuidv4();
    const appNumber = await this.generateAppNumber();

    const finalTitle =
      params.title?.trim() ||
      (params.financialYear
        ? `${service.name} (FY ${params.financialYear})`
        : service.name);

    const finalDescription = params.description || params.notes || null;

    const appId = await ApplicationRepository.create({
      publicId,
      applicationNumber: appNumber,
      clientId: client.id,
      serviceId: params.serviceId,
      title: finalTitle,
      description: finalDescription,
      priority: params.priority,
      quotedAmount: service.base_price ? parseFloat(service.base_price) : null,
      createdBy: params.userId,
    });

    await AuditService.log({
      userId: params.userId,
      action: 'CREATE_APPLICATION',
      entityType: 'APPLICATION',
      entityId: appId,
      newValues: { applicationNumber: appNumber, title: params.title },
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    return ApplicationRepository.findByPublicId(publicId);
  }

  static async updateStatus(
    publicId: string,
    newStatus: ApplicationStatus,
    changedByUserId: number,
    reason?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const app = await ApplicationRepository.findByPublicId(publicId);
    if (!app) {
      throw ApiError.notFound('Application not found', ErrorCodes.APPLICATION_NOT_FOUND);
    }

    await ApplicationRepository.updateStatus({
      applicationId: app.id,
      oldStatus: app.status,
      newStatus,
      changedBy: changedByUserId,
      reason,
    });

    await AuditService.log({
      userId: changedByUserId,
      action: 'APPLICATION_STATUS_CHANGE',
      entityType: 'APPLICATION',
      entityId: app.id,
      oldValues: { status: app.status },
      newValues: { status: newStatus, reason },
      ipAddress,
      userAgent,
    });

    return ApplicationRepository.findByPublicId(publicId);
  }

  static async assignConsultant(
    publicId: string,
    consultantId: number,
    assignedByUserId: number,
    notes?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const app = await ApplicationRepository.findByPublicId(publicId);
    if (!app) {
      throw ApiError.notFound('Application not found', ErrorCodes.APPLICATION_NOT_FOUND);
    }

    const consultant = await UserRepository.findById(consultantId);
    if (!consultant || consultant.status !== 'ACTIVE') {
      throw ApiError.badRequest('Assigned consultant user not found or inactive');
    }

    await ApplicationRepository.assignConsultant({
      applicationId: app.id,
      consultantId,
      assignedBy: assignedByUserId,
      notes,
    });

    await AuditService.log({
      userId: assignedByUserId,
      action: 'CONSULTANT_ASSIGNED',
      entityType: 'APPLICATION',
      entityId: app.id,
      newValues: { consultantId, notes },
      ipAddress,
      userAgent,
    });

    return ApplicationRepository.findByPublicId(publicId);
  }

  static async getApplicationByPublicId(publicId: string) {
    const app = await ApplicationRepository.findByPublicId(publicId);
    if (!app) {
      throw ApiError.notFound('Application not found', ErrorCodes.APPLICATION_NOT_FOUND);
    }
    const history = await ApplicationRepository.getStatusHistory(app.id);
    return { ...app, history };
  }

  static async listApplications(params: {
    clientId?: number;
    consultantId?: number;
    status?: string;
    priority?: string;
    serviceId?: number;
    search?: string;
    limit: number;
    offset: number;
  }) {
    return ApplicationRepository.list(params);
  }

  static async trackByNumber(refNumber: string) {
    const app = await ApplicationRepository.findByApplicationNumber(refNumber.trim().toUpperCase());
    if (!app) {
      throw ApiError.notFound('No application found with this reference number. Please check and try again.');
    }
    const history = await ApplicationRepository.getStatusHistory(app.id);
    return {
      referenceNumber: app.application_number,
      title: app.title,
      serviceName: app.service_name,
      categoryName: app.category_name,
      status: app.status,
      priority: app.priority,
      createdAt: app.created_at,
      updatedAt: app.updated_at,
      history,
    };
  }
}
