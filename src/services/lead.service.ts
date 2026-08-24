import { v4 as uuidv4 } from 'uuid';
import { LeadRepository } from '../repositories/lead.repository';
import { AuthService } from './auth.service';
import { ApiError } from '../utils/apiError';
import { ErrorCodes } from '../constants/errorCodes';
import { LeadStatus } from '../types/models';
import { AuditService } from '../middleware/audit.middleware';

export class LeadService {
  static async createLead(params: {
    name: string;
    email?: string;
    phone?: string;
    serviceId?: number;
    businessType?: string;
    city?: string;
    message?: string;
    source?: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const publicId = uuidv4();
    const leadId = await LeadRepository.create({
      publicId,
      name: params.name,
      email: params.email,
      phone: params.phone,
      serviceId: params.serviceId,
      businessType: params.businessType,
      city: params.city,
      message: params.message,
      source: params.source,
    });

    await AuditService.log({
      action: 'LEAD_CREATED',
      entityType: 'LEAD',
      entityId: leadId,
      newValues: { name: params.name, email: params.email },
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    return LeadRepository.findByPublicId(publicId);
  }

  static async updateStatus(
    publicId: string,
    status: LeadStatus,
    assignedTo?: number,
    performedByUserId?: number
  ) {
    const lead = await LeadRepository.findByPublicId(publicId);
    if (!lead) {
      throw ApiError.notFound('Lead not found', ErrorCodes.RESOURCE_NOT_FOUND);
    }

    await LeadRepository.updateStatus(lead.id, status, assignedTo);

    await AuditService.log({
      userId: performedByUserId,
      action: 'LEAD_STATUS_CHANGED',
      entityType: 'LEAD',
      entityId: lead.id,
      newValues: { status, assignedTo },
    });

    return LeadRepository.findByPublicId(publicId);
  }

  static async convertLeadToClient(
    publicId: string,
    params: {
      clientType: 'INDIVIDUAL' | 'BUSINESS';
      temporaryPassword: string;
    },
    performedByUserId: number
  ) {
    const lead = await LeadRepository.findByPublicId(publicId);
    if (!lead) {
      throw ApiError.notFound('Lead not found', ErrorCodes.RESOURCE_NOT_FOUND);
    }
    if (!lead.email) {
      throw ApiError.badRequest('Cannot convert lead without an email address');
    }

    const nameParts = lead.name.trim().split(' ');
    const firstName = nameParts[0] || 'Client';
    const lastName = nameParts.slice(1).join(' ') || 'User';

    // Register user & create client
    const { user } = await AuthService.register({
      firstName,
      lastName,
      email: lead.email,
      phone: lead.phone || undefined,
      password: params.temporaryPassword,
      clientType: params.clientType,
      businessName: lead.business_type || undefined,
    });

    if (user.clientId) {
      await LeadRepository.markConverted(lead.id, user.clientId);
    }

    await AuditService.log({
      userId: performedByUserId,
      action: 'LEAD_CONVERTED_TO_CLIENT',
      entityType: 'LEAD',
      entityId: lead.id,
      newValues: { clientPublicId: user.clientPublicId },
    });

    return user;
  }

  static async listLeads(params: {
    status?: string;
    assignedTo?: number;
    search?: string;
    limit: number;
    offset: number;
  }) {
    return LeadRepository.list(params);
  }
}
