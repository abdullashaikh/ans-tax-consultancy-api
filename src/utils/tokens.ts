import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env';
import { AccessTokenPayload, RefreshTokenPayload, AuthTokens } from '../types/auth';
import { RoleName } from '../constants/roles';
import { PermissionName } from '../constants/permissions';
import { ApiError } from './apiError';
import { ErrorCodes } from '../constants/errorCodes';

export class TokenUtil {
  /**
   * Generates a pair of access and refresh tokens.
   */
  static generateAuthTokens(params: {
    userId: number;
    publicId: string;
    email: string;
    roles: RoleName[];
    permissions: PermissionName[];
    clientId?: number;
    clientPublicId?: string;
  }): { tokens: AuthTokens; rawRefreshToken: string; refreshTokenHash: string; tokenId: string } {
    const tokenId = uuidv4();

    // 1. Access Token (15 min)
    const accessPayload: AccessTokenPayload = {
      sub: params.publicId,
      userId: params.userId,
      email: params.email,
      roles: params.roles,
      permissions: params.permissions,
      clientId: params.clientId,
      clientPublicId: params.clientPublicId,
      type: 'access',
    };

    const accessToken = jwt.sign(accessPayload, env.JWT_ACCESS_SECRET, {
      expiresIn: env.ACCESS_TOKEN_EXPIRES_IN as any,
      issuer: 'ans-tax-backend',
      audience: 'ans-tax-clients',
    });

    // 2. Refresh Token (7 days)
    const refreshPayload: RefreshTokenPayload = {
      sub: params.publicId,
      userId: params.userId,
      tokenId,
      type: 'refresh',
    };

    const refreshToken = jwt.sign(refreshPayload, env.JWT_REFRESH_SECRET, {
      expiresIn: env.REFRESH_TOKEN_EXPIRES_IN as any,
      issuer: 'ans-tax-backend',
      audience: 'ans-tax-clients',
    });

    // Compute SHA-256 hash of refresh token for database storage / replay detection
    const refreshTokenHash = TokenUtil.hashRefreshToken(refreshToken);

    return {
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: 15 * 60, // 15 mins in seconds
      },
      rawRefreshToken: refreshToken,
      refreshTokenHash,
      tokenId,
    };
  }

  /**
   * Verifies an access token.
   */
  static verifyAccessToken(token: string): AccessTokenPayload {
    try {
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
        issuer: 'ans-tax-backend',
        audience: 'ans-tax-clients',
      }) as AccessTokenPayload;

      if (decoded.type !== 'access') {
        throw ApiError.unauthorized('Invalid token type', ErrorCodes.AUTH_TOKEN_INVALID);
      }

      return decoded;
    } catch (error: any) {
      if (error instanceof ApiError) throw error;
      if (error.name === 'TokenExpiredError') {
        throw ApiError.unauthorized('Access token has expired', ErrorCodes.AUTH_TOKEN_EXPIRED);
      }
      throw ApiError.unauthorized('Invalid access token', ErrorCodes.AUTH_TOKEN_INVALID);
    }
  }

  /**
   * Verifies a refresh token.
   */
  static verifyRefreshToken(token: string): RefreshTokenPayload {
    try {
      const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET, {
        issuer: 'ans-tax-backend',
        audience: 'ans-tax-clients',
      }) as RefreshTokenPayload;

      if (decoded.type !== 'refresh') {
        throw ApiError.unauthorized('Invalid refresh token type', ErrorCodes.AUTH_TOKEN_INVALID);
      }

      return decoded;
    } catch (error: any) {
      if (error instanceof ApiError) throw error;
      if (error.name === 'TokenExpiredError') {
        throw ApiError.unauthorized('Refresh token has expired, please log in again', ErrorCodes.AUTH_TOKEN_EXPIRED);
      }
      throw ApiError.unauthorized('Invalid refresh token', ErrorCodes.AUTH_TOKEN_INVALID);
    }
  }

  /**
   * Hashes a refresh token using SHA-256 for secure DB persistence.
   */
  static hashRefreshToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
