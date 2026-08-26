import { ClientRepository } from '../repositories/client.repository';
import { ApiError } from '../utils/apiError';
import { ErrorCodes } from '../constants/errorCodes';
import { ClientStatus, AddressType } from '../types/models';
import { AuditService } from '../middleware/audit.middleware';

export class ClientService {
  static async listClients(params: {
    clientType?: string;
    status?: string;
    search?: string;
    limit: number;
    offset: number;
  }) {
    return ClientRepository.list(params);
  }

  static async getMyProfile(userId: number) {
    const client = await ClientRepository.findByUserId(userId);
    if (!client) {
      throw ApiError.notFound('Client profile not found for current user', ErrorCodes.CLIENT_NOT_FOUND);
    }
    const addresses = await ClientRepository.getAddresses(client.id);
    return { ...client, addresses };
  }

  static async updateMyProfile(
    userId: number,
    params: {
      legalName?: string;
      displayName?: string | null;
      email?: string | null;
      phone?: string | null;
      alternatePhone?: string | null;
      businessType?: string | null;
      gstin?: string | null;
      panReference?: string | null;
    }
  ) {
    const client = await ClientRepository.findByUserId(userId);
    if (!client) {
      throw ApiError.notFound('Client profile not found for current user', ErrorCodes.CLIENT_NOT_FOUND);
    }
    return this.updateClient(client.public_id, params, userId);
  }

  static async getClientByPublicId(publicId: string) {
    const client = await ClientRepository.findByPublicId(publicId);
    if (!client) {
      throw ApiError.notFound('Client profile not found', ErrorCodes.CLIENT_NOT_FOUND);
    }
    const addresses = await ClientRepository.getAddresses(client.id);
    return { ...client, addresses };
  }

  static async updateClient(
    publicId: string,
    params: {
      legalName?: string;
      displayName?: string | null;
      email?: string | null;
      phone?: string | null;
      alternatePhone?: string | null;
      businessType?: string | null;
      gstin?: string | null;
      panReference?: string | null;
      status?: ClientStatus;
    },
    performedByUserId: number
  ) {
    const client = await ClientRepository.findByPublicId(publicId);
    if (!client) {
      throw ApiError.notFound('Client profile not found', ErrorCodes.CLIENT_NOT_FOUND);
    }

    await ClientRepository.update(client.id, params);

    await AuditService.log({
      userId: performedByUserId,
      action: 'UPDATE_CLIENT',
      entityType: 'CLIENT',
      entityId: client.id,
      newValues: params,
    });

    return this.getClientByPublicId(publicId);
  }

  static async addAddress(
    clientPublicId: string,
    params: {
      addressType: AddressType;
      addressLine1: string;
      addressLine2?: string | null;
      city: string;
      state: string;
      country: string;
      postalCode: string;
      isPrimary?: boolean;
    }
  ) {
    const client = await ClientRepository.findByPublicId(clientPublicId);
    if (!client) {
      throw ApiError.notFound('Client profile not found', ErrorCodes.CLIENT_NOT_FOUND);
    }

    const addressId = await ClientRepository.addAddress({
      clientId: client.id,
      ...params,
    });

    return { addressId, ...params };
  }
}
