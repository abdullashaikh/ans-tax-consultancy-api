/// <reference path="../types/express.d.ts" />
import { Request, Response, NextFunction } from 'express';
import { TokenUtil } from '../utils/tokens';
import { ApiError } from '../utils/apiError';
import { ErrorCodes } from '../constants/errorCodes';
import { AuthenticatedUser } from '../types/auth';

export const requireAuth = (req: Request, _res: Response, next: NextFunction): void => {
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
    };

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

export const optionalAuth = (req: Request, _res: Response, next: NextFunction): void => {
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
      req.user = {
        id: payload.userId,
        publicId: payload.sub,
        email: payload.email,
        firstName: '',
        lastName: '',
        roles: payload.roles,
        permissions: payload.permissions,
      };
    }
    next();
  } catch {
    // Silently continue without authenticated user
    next();
  }
};
