import { UserRepository } from '../repositories/user.repository';
import { ApiError } from '../utils/apiError';
import { ErrorCodes } from '../constants/errorCodes';
import { RoleName } from '../constants/roles';
import { UserStatus } from '../types/models';
import { PasswordUtil } from '../utils/password';
import { AuditService } from '../middleware/audit.middleware';

export class UserService {
  static async listUsers(params: {
    status?: string;
    search?: string;
    limit: number;
    offset: number;
  }) {
    return UserRepository.list(params);
  }

  static async getUserByPublicId(publicId: string) {
    const user = await UserRepository.findByPublicId(publicId);
    if (!user) {
      throw ApiError.notFound('User not found', ErrorCodes.USER_NOT_FOUND);
    }
    const roles = await UserRepository.getUserRoles(user.id);
    const permissions = await UserRepository.getUserPermissions(user.id);
    return { ...user, roles, permissions };
  }

  static async updateProfile(userId: number, params: {
    firstName?: string;
    lastName?: string;
    phone?: string;
  }) {
    await UserRepository.update(userId, params);
    return UserRepository.findById(userId);
  }

  static async changePassword(userId: number, params: {
    currentPassword: string;
    newPassword: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const user = await UserRepository.findById(userId);
    if (!user) {
      throw ApiError.notFound('User not found', ErrorCodes.USER_NOT_FOUND);
    }

    const fullUser = await UserRepository.findByEmail(user.email);
    if (!fullUser) {
      throw ApiError.notFound('User not found', ErrorCodes.USER_NOT_FOUND);
    }

    const isMatch = await PasswordUtil.compare(params.currentPassword, fullUser.password_hash);
    if (!isMatch) {
      throw ApiError.badRequest('Current password does not match');
    }

    const strength = PasswordUtil.validateStrength(params.newPassword);
    if (!strength.isValid) {
      throw ApiError.badRequest(strength.message || 'New password does not meet complexity requirements');
    }

    const newHash = await PasswordUtil.hash(params.newPassword);
    await UserRepository.updatePassword(userId, newHash);

    await AuditService.log({
      userId,
      action: 'PASSWORD_CHANGED',
      entityType: 'USER',
      entityId: userId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });
  }

  static async adminUpdateUser(
    targetPublicId: string,
    params: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      status?: UserStatus;
      roles?: RoleName[];
    },
    adminUserId: number
  ) {
    const user = await UserRepository.findByPublicId(targetPublicId);
    if (!user) {
      throw ApiError.notFound('User not found', ErrorCodes.USER_NOT_FOUND);
    }

    await UserRepository.update(user.id, {
      firstName: params.firstName,
      lastName: params.lastName,
      phone: params.phone,
      status: params.status,
    });

    if (params.roles && params.roles.length > 0) {
      for (const role of params.roles) {
        await UserRepository.assignRole(user.id, role, adminUserId);
      }
    }

    await AuditService.log({
      userId: adminUserId,
      action: 'ADMIN_UPDATED_USER',
      entityType: 'USER',
      entityId: user.id,
      newValues: params,
    });

    return this.getUserByPublicId(targetPublicId);
  }
}
