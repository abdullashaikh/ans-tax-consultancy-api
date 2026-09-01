import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { UserRepository } from '../repositories/user.repository';
import { ClientRepository } from '../repositories/client.repository';
import { OtpRepository } from '../repositories/otp.repository';
import { OtpService } from './otp/otp.service';
import { TokenUtil } from '../utils/tokens';
import { PasswordUtil } from '../utils/password';
import { ApiError } from '../utils/apiError';
import { ErrorCodes } from '../constants/errorCodes';
import { AuthTokens, AuthenticatedUser } from '../types/auth';
import { AuditService } from '../middleware/audit.middleware';
import { withTransaction } from '../config/database';

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
      clientId,
      clientPublicId,
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
      clientId: clientRecord?.id,
      clientPublicId: clientRecord?.public_id,
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
      clientId: clientRecord?.id,
      clientPublicId: clientRecord?.public_id,
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
   * Initiates forgot password flow using secure OTP delivery via Resend.
   */
  static async forgotPassword(
    email: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ challengeId?: string; destinationMasked?: string; message: string }> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await UserRepository.findByEmail(normalizedEmail);

    if (user && user.status === 'ACTIVE') {
      const otpResult = await OtpService.requestOtp({
        identifier: normalizedEmail,
        channel: 'EMAIL',
        purpose: 'PASSWORD_RESET',
        ipAddress,
        userAgent,
      });

      await AuditService.log({
        userId: user.id,
        action: 'PASSWORD_RESET_REQUESTED',
        entityType: 'AUTH',
        newValues: { email: normalizedEmail, challengeId: otpResult.challengeId },
        ipAddress,
        userAgent,
      });

      return {
        challengeId: otpResult.challengeId,
        destinationMasked: otpResult.destinationMasked,
        message: `Password reset verification code sent to ${otpResult.destinationMasked}`,
      };
    }

    // Generic response to prevent account enumeration
    return {
      message: 'If an active account exists for this email, a verification code has been sent.',
    };
  }

  /**
   * Completes password reset using verified OTP session and updates credentials.
   */
  static async resetPassword(params: {
    challengeId?: string;
    otp?: string;
    token?: string;
    newPassword: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    const strength = PasswordUtil.validateStrength(params.newPassword);
    if (!strength.isValid) {
      throw ApiError.badRequest(strength.message || 'Password does not meet complexity requirements');
    }

    if (params.challengeId && params.otp) {
      const challenge = await OtpRepository.findByPublicId(params.challengeId);
      if (!challenge) {
        throw ApiError.badRequest('Invalid or expired verification session. Please request a new code.');
      }

      if (challenge.status === 'VERIFIED') {
        throw ApiError.badRequest('This verification code has already been used.');
      }

      if (challenge.status === 'BLOCKED' || challenge.status === 'CANCELLED' || challenge.status === 'EXPIRED') {
        throw ApiError.badRequest('This verification session is no longer active. Please request a new code.');
      }

      const now = new Date();
      if (now > new Date(challenge.expires_at)) {
        await OtpRepository.markStatus(challenge.id, 'EXPIRED');
        throw ApiError.badRequest('Verification code has expired. Please request a new code.');
      }

      // Verify code hash
      const candidateHash = OtpService.hashCode(params.otp);
      const storedHashPrefix = 'code_hash:';
      const storedHash = challenge.provider_request_id?.startsWith(storedHashPrefix)
        ? challenge.provider_request_id.slice(storedHashPrefix.length)
        : challenge.provider_request_id || '';

      let isValid = false;
      if (storedHash && storedHash.length === candidateHash.length) {
        try {
          isValid = crypto.timingSafeEqual(
            Buffer.from(candidateHash, 'hex'),
            Buffer.from(storedHash, 'hex')
          );
        } catch {
          isValid = false;
        }
      }

      if (!isValid) {
        const updatedAttempts = await OtpRepository.incrementAttempts(challenge.id);
        const remainingAttempts = Math.max(0, challenge.max_attempts - updatedAttempts);
        if (updatedAttempts >= challenge.max_attempts) {
          await OtpRepository.markStatus(challenge.id, 'BLOCKED');
          throw ApiError.badRequest('Maximum verification attempts exceeded. Please request a new code.');
        }
        throw ApiError.badRequest(`Invalid verification code. ${remainingAttempts} attempt(s) remaining.`);
      }

      // Mark challenge verified
      await OtpRepository.markVerified(challenge.id);

      // Identify user
      const userId = challenge.user_id;
      if (!userId) {
        throw ApiError.badRequest('No valid user account linked to this reset session. Please request a new code.');
      }

      const userRecord = await UserRepository.findById(userId);
      if (!userRecord || userRecord.status !== 'ACTIVE') {
        throw ApiError.badRequest('User account is not active or has been suspended.');
      }

      // Hash and update password
      const newHash = await PasswordUtil.hash(params.newPassword);
      await UserRepository.updatePassword(userRecord.id, newHash);

      // Audit log
      await AuditService.log({
        userId: userRecord.id,
        action: 'PASSWORD_RESET_SUCCESS',
        entityType: 'AUTH',
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      });

      return;
    }

    throw ApiError.badRequest('Valid challenge ID and verification code are required.');
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
