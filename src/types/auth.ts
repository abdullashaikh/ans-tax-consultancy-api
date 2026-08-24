import { RoleName } from '../constants/roles';
import { PermissionName } from '../constants/permissions';

export interface AuthenticatedUser {
  id: number;
  publicId: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: RoleName[];
  permissions: PermissionName[];
  clientId?: number;
  clientPublicId?: string;
}

export interface AccessTokenPayload {
  sub: string; // public_id
  userId: number;
  email: string;
  roles: RoleName[];
  permissions: PermissionName[];
  type: 'access';
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  sub: string; // public_id
  userId: number;
  tokenId: string; // unique rotation identifier
  type: 'refresh';
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
}
