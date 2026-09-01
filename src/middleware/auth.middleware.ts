/// <reference path="../types/express.d.ts" />
import { Request, Response, NextFunction } from 'express';
import { TokenUtil } from '../utils/tokens';
import { ApiError } from '../utils/apiError';
import { ErrorCodes } from '../constants/errorCodes';
import { AuthenticatedUser } from '../types/auth';
import { RoleName } from '../constants/roles';
import { ClientRepository } from '../repositories/client.repository';

export const requireAuth = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    let token: string | undefined;

    // 1. Check Authorization header (Bearer <token>)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    // 2. Fallback to access_token cookie if present
    if (!token && req.cookies?.['access_token']) {
      token = req.cookies['access_token'];
    }

    if (!token) {
      throw ApiError.unauthorized('Authentication token required', ErrorCodes.AUTH_UNAUTHORIZED);
    }

    // 3. Verify access token
    const payload = TokenUtil.verifyAccessToken(token);

    // 4. Attach authenticated user to request context
    const user: AuthenticatedUser = {
      id: payload.userId,
      publicId: payload.sub,
      email: payload.email,
      firstName: '', // Will be populated in service if needed
      lastName: '',
      roles: payload.roles,
      permissions: payload.permissions,
      clientId: payload.clientId,
      clientPublicId: payload.clientPublicId,
    };

    // 5. If clientId was not in token, resolve from DB for clients
    const isClientRole = user.roles.includes(RoleName.CLIENT) || !user.roles.some(r => [RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.CONSULTANT, RoleName.STAFF].includes(r));
    if (!user.clientId && isClientRole) {
      const clientRecord = await ClientRepository.findByUserId(user.id);
      if (clientRecord) {
        user.clientId = clientRecord.id;
        user.clientPublicId = clientRecord.public_id;
      }
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

export const optionalAuth = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    let token: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.cookies?.['access_token']) {
      token = req.cookies['access_token'];
    }

    if (token) {
      const payload = TokenUtil.verifyAccessToken(token);
      const user: AuthenticatedUser = {
        id: payload.userId,
        publicId: payload.sub,
        email: payload.email,
        firstName: '',
        lastName: '',
        roles: payload.roles,
        permissions: payload.permissions,
        clientId: payload.clientId,
        clientPublicId: payload.clientPublicId,
      };

      // Resolve clientId for client users if missing from token
      const isClientRole = user.roles.includes(RoleName.CLIENT) || !user.roles.some(r => [RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.CONSULTANT, RoleName.STAFF].includes(r));
      if (!user.clientId && isClientRole) {
        const clientRecord = await ClientRepository.findByUserId(user.id);
        if (clientRecord) {
          user.clientId = clientRecord.id;
          user.clientPublicId = clientRecord.public_id;
        }
      }

      req.user = user;
    }
    next();
  } catch {
    // Silently continue without authenticated user
    next();
  }
};
