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

  static async createStaffUser(
    params: {
      firstName: string;
      lastName: string;
      email: string;
      phone?: string;
      password: string;
      roles: RoleName[];
      status?: UserStatus;
    },
    callerUser: { id: number; roles: RoleName[] },
    ipAddress?: string,
    userAgent?: string
  ) {
    if (!callerUser.roles.includes(RoleName.SUPER_ADMIN)) {
      throw ApiError.forbidden('Only a Super Admin can create staff accounts.');
    }

    const existingEmail = await UserRepository.findByEmail(params.email);
    if (existingEmail) {
      throw ApiError.conflict('A user with this email address already exists.');
    }

    if (params.phone) {
      const existingPhone = await UserRepository.findByPhone(params.phone);
      if (existingPhone) {
        throw ApiError.conflict('A user with this phone number already exists.');
      }
    }

    const strength = PasswordUtil.validateStrength(params.password);
    if (!strength.isValid) {
      throw ApiError.badRequest(strength.message || 'Password does not meet complexity requirements');
    }

    const passwordHash = await PasswordUtil.hash(params.password);
    const { v4: uuidv4 } = require('uuid');
    const publicId = `usr-${uuidv4()}`;

    const newUserId = await UserRepository.create({
      publicId,
      firstName: params.firstName,
      lastName: params.lastName,
      email: params.email,
      phone: params.phone,
      passwordHash,
      status: params.status || 'ACTIVE',
    });

    const rolesToAssign = params.roles && params.roles.length > 0 ? params.roles : [RoleName.STAFF];
    for (const role of rolesToAssign) {
      await UserRepository.assignRole(newUserId, role, callerUser.id);
    }

    await AuditService.log({
      userId: callerUser.id,
      action: 'STAFF_USER_CREATED',
      entityType: 'USER',
      entityId: newUserId,
      newValues: { email: params.email, roles: rolesToAssign, status: params.status || 'ACTIVE' },
      ipAddress,
      userAgent,
    });

    return this.getUserByPublicId(publicId);
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
    callerUser: { id: number; roles: RoleName[] },
    ipAddress?: string,
    userAgent?: string
  ) {
    const user = await UserRepository.findByPublicId(targetPublicId);
    if (!user) {
      throw ApiError.notFound('User not found', ErrorCodes.USER_NOT_FOUND);
    }

    // Role modification guardrails
    if (params.roles && params.roles.length > 0) {
      const isCallerSuperAdmin = callerUser.roles.includes(RoleName.SUPER_ADMIN);
      const isGrantingSuperAdmin = params.roles.includes(RoleName.SUPER_ADMIN);

      if (isGrantingSuperAdmin && !isCallerSuperAdmin) {
        throw ApiError.forbidden('Only a Super Admin can grant the Super Admin role.');
      }

      // Check if target currently has SUPER_ADMIN and caller is attempting to revoke it
      const currentRoles = await UserRepository.getUserRoles(user.id);
      const isTargetSuperAdmin = currentRoles.includes(RoleName.SUPER_ADMIN);
      if (isTargetSuperAdmin && !isGrantingSuperAdmin && !isCallerSuperAdmin) {
        throw ApiError.forbidden('Only a Super Admin can modify another Super Admin account.');
      }

      await UserRepository.syncUserRoles(user.id, params.roles, callerUser.id);
    }

    await UserRepository.update(user.id, {
      firstName: params.firstName,
      lastName: params.lastName,
      phone: params.phone,
      status: params.status,
    });

    await AuditService.log({
      userId: callerUser.id,
      action: 'ADMIN_UPDATED_USER',
      entityType: 'USER',
      entityId: user.id,
      newValues: params,
      ipAddress,
      userAgent,
    });

    return this.getUserByPublicId(targetPublicId);
  }
}
