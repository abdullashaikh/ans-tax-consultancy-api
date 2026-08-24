import { Request, Response, NextFunction } from 'express';
import { RoleName } from '../constants/roles';
import { PermissionName } from '../constants/permissions';
import { ApiError } from '../utils/apiError';
import { ErrorCodes } from '../constants/errorCodes';

/**
 * Ensures the authenticated user possesses AT LEAST ONE of the allowed roles.
 */
export const requireRole = (...allowedRoles: RoleName[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required', ErrorCodes.AUTH_UNAUTHORIZED));
    }

    const hasRole = req.user.roles.some((role) => allowedRoles.includes(role));
    if (!hasRole) {
      return next(
        ApiError.forbidden(
          `Access denied: required role (${allowedRoles.join(', ')})`,
          ErrorCodes.AUTH_FORBIDDEN
        )
      );
    }

    next();
  };
};

/**
 * Ensures the authenticated user possesses ALL of the required permissions.
 * (SUPER_ADMIN always bypasses permission checks).
 */
export const requirePermission = (...requiredPermissions: PermissionName[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required', ErrorCodes.AUTH_UNAUTHORIZED));
    }

    // Super Admin has all capabilities
    if (req.user.roles.includes(RoleName.SUPER_ADMIN)) {
      return next();
    }

    const userPerms = req.user.permissions || [];
    const hasAll = requiredPermissions.every((perm) => userPerms.includes(perm));

    if (!hasAll) {
      return next(
        ApiError.forbidden(
          `Access denied: missing required permission (${requiredPermissions.join(', ')})`,
          ErrorCodes.AUTH_INSUFFICIENT_PERMISSIONS
        )
      );
    }

    next();
  };
};

/**
 * Ensures the authenticated user possesses AT LEAST ONE of the specified permissions.
 */
export const requireAnyPermission = (...permissions: PermissionName[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required', ErrorCodes.AUTH_UNAUTHORIZED));
    }

    if (req.user.roles.includes(RoleName.SUPER_ADMIN)) {
      return next();
    }

    const userPerms = req.user.permissions || [];
    const hasAny = permissions.some((perm) => userPerms.includes(perm));

    if (!hasAny) {
      return next(
        ApiError.forbidden(
          `Access denied: requires one of [${permissions.join(', ')}]`,
          ErrorCodes.AUTH_INSUFFICIENT_PERMISSIONS
        )
      );
    }

    next();
  };
};
