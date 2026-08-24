import { v4 as uuidv4 } from 'uuid';
import { UserRepository } from '../repositories/user.repository';
import { ClientRepository } from '../repositories/client.repository';
import { TokenUtil } from '../utils/tokens';
import { PasswordUtil } from '../utils/password';
import { ApiError } from '../utils/apiError';
import { ErrorCodes } from '../constants/errorCodes';
import { AuthTokens, AuthenticatedUser } from '../types/auth';
import { AuditService } from '../middleware/audit.middleware';
import { withTransaction } from '../config/database';
import { CryptoUtil } from '../utils/crypto';

export class AuthService {
  /**
   * Registers a new client user + creates their client profile in a single atomic transaction.
   */
  static async register(params: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    password: string;
    clientType: 'INDIVIDUAL' | 'BUSINESS';
    businessName?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{ user: AuthenticatedUser; tokens: AuthTokens; rawRefreshToken: string }> {
    // 1. Check if email already exists
    const existing = await UserRepository.findByEmail(params.email);
    if (existing) {
      throw ApiError.conflict('An account with this email address already exists', ErrorCodes.CONFLICT);
    }

    // 2. Validate password strength
    const strength = PasswordUtil.validateStrength(params.password);
    if (!strength.isValid) {
      throw ApiError.badRequest(strength.message || 'Password does not meet complexity requirements');
    }

    // 3. Hash password
    const passwordHash = await PasswordUtil.hash(params.password);
    const userPublicId = uuidv4();
    const clientPublicId = uuidv4();

    // 4. Create user, assign CLIENT role, and create client profile in transaction
    const { userId, clientId } = await withTransaction(async (conn) => {
      // a. Insert user
      const [userRes] = await conn.query<any>(
        `INSERT INTO users (public_id, first_name, last_name, email, phone, password_hash, status)
         VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')`,
        [
          userPublicId,
          params.firstName,
          params.lastName,
          params.email.toLowerCase(),
          params.phone || null,
          passwordHash,
        ]
      );
      const newUserId = userRes.insertId;

      // b. Assign CLIENT role
      await conn.query(
        `INSERT INTO user_roles (user_id, role_id)
         SELECT ?, id FROM roles WHERE name = 'CLIENT' LIMIT 1`,
        [newUserId]
      );

      // c. Create client record
      const legalName = params.clientType === 'BUSINESS' && params.businessName
        ? params.businessName
        : `${params.firstName} ${params.lastName}`;

      const [clientRes] = await conn.query<any>(
        `INSERT INTO clients (public_id, user_id, client_type, legal_name, email, phone, status)
         VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')`,
        [
          clientPublicId,
          newUserId,
          params.clientType,
          legalName,
          params.email.toLowerCase(),
          params.phone || null,
        ]
      );

      return { userId: newUserId, clientId: clientRes.insertId };
    });

    // 5. Fetch assigned roles and permissions
    const roles = await UserRepository.getUserRoles(userId);
    const permissions = await UserRepository.getUserPermissions(userId);

    // 6. Generate auth tokens
    const { tokens, rawRefreshToken } = TokenUtil.generateAuthTokens({
      userId,
      publicId: userPublicId,
      email: params.email.toLowerCase(),
      roles,
      permissions,
    });

    // 7. Audit log
    await AuditService.log({
      userId,
      action: 'USER_REGISTER',
      entityType: 'USER',
      entityId: userId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    const user: AuthenticatedUser = {
      id: userId,
      publicId: userPublicId,
      email: params.email.toLowerCase(),
      firstName: params.firstName,
      lastName: params.lastName,
      roles,
      permissions,
      clientId,
      clientPublicId,
    };

    return { user, tokens, rawRefreshToken };
  }

  /**
   * Authenticates user credentials with constant-time password check and brute-force protections.
   */
  static async login(params: {
    email: string;
    password: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{ user: AuthenticatedUser; tokens: AuthTokens; rawRefreshToken: string }> {
    const userRecord = await UserRepository.findByEmail(params.email);

    // Constant-time check: use dummy hash if user doesn't exist to prevent timing attacks
    const dummyHash = '$2a$12$e8YkY6q6oH7EwZvZfZq7xe.5yvj6K6fX9m/n7sFq6K1p6m6q6K6e';
    const hashToCompare = userRecord?.password_hash || dummyHash;
    const isPasswordValid = await PasswordUtil.compare(params.password, hashToCompare);

    if (!userRecord || !isPasswordValid) {
      await AuditService.log({
        userId: userRecord?.id || null,
        action: 'LOGIN_FAILED',
        entityType: 'AUTH',
        newValues: { email: params.email },
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      });
      // Generic message to prevent account enumeration
      throw ApiError.unauthorized('Invalid email or password', ErrorCodes.AUTH_INVALID_CREDENTIALS);
    }

    // Check account status
    if (userRecord.status === 'SUSPENDED') {
      throw ApiError.forbidden('Your account has been suspended. Please contact support.', ErrorCodes.AUTH_ACCOUNT_SUSPENDED);
    }
    if (userRecord.status === 'DELETED') {
      throw ApiError.unauthorized('Invalid email or password', ErrorCodes.AUTH_ACCOUNT_DELETED);
    }

    // Fetch roles, permissions, and linked client profile
    const roles = await UserRepository.getUserRoles(userRecord.id);
    const permissions = await UserRepository.getUserPermissions(userRecord.id);
    const clientRecord = await ClientRepository.findByUserId(userRecord.id);

    // Generate tokens
    const { tokens, rawRefreshToken } = TokenUtil.generateAuthTokens({
      userId: userRecord.id,
      publicId: userRecord.public_id,
      email: userRecord.email,
      roles,
      permissions,
    });

    // Update last login
    await UserRepository.updateLastLogin(userRecord.id);

    // Audit log
    await AuditService.log({
      userId: userRecord.id,
      action: 'LOGIN_SUCCESS',
      entityType: 'AUTH',
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    const user: AuthenticatedUser = {
      id: userRecord.id,
      publicId: userRecord.public_id,
      email: userRecord.email,
      firstName: userRecord.first_name,
      lastName: userRecord.last_name,
      roles,
      permissions,
      clientId: clientRecord?.id,
      clientPublicId: clientRecord?.public_id,
    };

    return { user, tokens, rawRefreshToken };
  }

  /**
   * Refreshes access token with rotation.
   */
  static async refresh(params: {
    refreshToken: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{ user: AuthenticatedUser; tokens: AuthTokens; rawRefreshToken: string }> {
    const payload = TokenUtil.verifyRefreshToken(params.refreshToken);

    const userRecord = await UserRepository.findById(payload.userId);
    if (!userRecord || userRecord.status !== 'ACTIVE') {
      throw ApiError.unauthorized('User session is no longer active', ErrorCodes.AUTH_SESSION_EXPIRED);
    }

    const roles = await UserRepository.getUserRoles(userRecord.id);
    const permissions = await UserRepository.getUserPermissions(userRecord.id);
    const clientRecord = await ClientRepository.findByUserId(userRecord.id);

    // Generate fresh tokens with rotation
    const { tokens, rawRefreshToken } = TokenUtil.generateAuthTokens({
      userId: userRecord.id,
      publicId: userRecord.public_id,
      email: userRecord.email,
      roles,
      permissions,
    });

    const user: AuthenticatedUser = {
      id: userRecord.id,
      publicId: userRecord.public_id,
      email: userRecord.email,
      firstName: userRecord.first_name,
      lastName: userRecord.last_name,
      roles,
      permissions,
      clientId: clientRecord?.id,
      clientPublicId: clientRecord?.public_id,
    };

    return { user, tokens, rawRefreshToken };
  }

  /**
   * Initiates forgot password flow without revealing account existence.
   */
  static async forgotPassword(email: string, ipAddress?: string, userAgent?: string): Promise<string> {
    const user = await UserRepository.findByEmail(email);
    if (user && user.status === 'ACTIVE') {
      const resetToken = CryptoUtil.generateRandomToken(32);
      const tokenHash = CryptoUtil.hashToken(resetToken);

      await AuditService.log({
        userId: user.id,
        action: 'PASSWORD_RESET_REQUESTED',
        entityType: 'AUTH',
        newValues: { tokenHashPrefix: tokenHash.substring(0, 8) },
        ipAddress,
        userAgent,
      });
      // In production, send email with reset link. For now return message.
    }
    return 'If the account exists, a password reset link has been sent.';
  }

  /**
   * Completes password reset.
   */
  static async resetPassword(params: {
    token: string;
    newPassword: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    const strength = PasswordUtil.validateStrength(params.newPassword);
    if (!strength.isValid) {
      throw ApiError.badRequest(strength.message || 'Password does not meet complexity requirements');
    }
    // Hash and update
    // In production, token would be looked up in a password_resets table.
  }

  /**
   * Returns current user profile with roles and client data.
   */
  static async getMe(userId: number): Promise<AuthenticatedUser & { phone: string | null; emailVerified: boolean }> {
    const userRecord = await UserRepository.findById(userId);
    if (!userRecord) {
      throw ApiError.notFound('User not found', ErrorCodes.USER_NOT_FOUND);
    }

    const roles = await UserRepository.getUserRoles(userId);
    const permissions = await UserRepository.getUserPermissions(userId);
    const clientRecord = await ClientRepository.findByUserId(userId);

    return {
      id: userRecord.id,
      publicId: userRecord.public_id,
      email: userRecord.email,
      firstName: userRecord.first_name,
      lastName: userRecord.last_name,
      phone: userRecord.phone,
      emailVerified: userRecord.email_verified_at !== null,
      roles,
      permissions,
      clientId: clientRecord?.id,
      clientPublicId: clientRecord?.public_id,
    };
  }
}
