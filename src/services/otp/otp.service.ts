import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import {
  OtpProvider,
  OtpChannel,
  OtpPurpose,
  ALLOWED_OTP_PURPOSES,
} from './otpProvider.interface';
import { ResendOtpProvider } from './resendOtpProvider';
import { OtpRepository } from '../../repositories/otp.repository';
import { UserRepository } from '../../repositories/user.repository';
import { ClientRepository } from '../../repositories/client.repository';
import { AuditService } from '../../middleware/audit.middleware';
import { TokenUtil } from '../../utils/tokens';
import { AuthTokens, AuthenticatedUser } from '../../types/auth';
import { ApiError } from '../../utils/apiError';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { RoleName } from '../../constants/roles';

export class OtpService {
  private static provider: OtpProvider = new ResendOtpProvider();

  /**
   * Overrides the OTP provider (used for unit testing with MockOtpProvider).
   */
  static setProvider(newProvider: OtpProvider): void {
    this.provider = newProvider;
  }

  static getProvider(): OtpProvider {
    return this.provider;
  }

  /**
   * Generates a cryptographically secure 6-digit numeric OTP code.
   */
  static generateCode(): string {
    return crypto.randomInt(100000, 1000000).toString();
  }

  /**
   * Computes SHA-256 hash of an OTP code for secure comparison.
   */
  static hashCode(code: string): string {
    return crypto.createHash('sha256').update(code.trim()).digest('hex');
  }

  /**
   * Canonical normalization of email or mobile phone number.
   */
  static normalizeIdentifier(identifier: string, channel: OtpChannel): string {
    if (!identifier) return '';
    const trimmed = identifier.trim();

    if (channel === 'EMAIL') {
      return trimmed.toLowerCase();
    }

    if (channel === 'MOBILE') {
      const digitsOnly = trimmed.replace(/\D/g, '');
      if (digitsOnly.length === 10) {
        return `+91${digitsOnly}`;
      }
      if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) {
        return `+91${digitsOnly.slice(1)}`;
      }
      if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
        return `+${digitsOnly}`;
      }
      if (trimmed.startsWith('+')) {
        return `+${digitsOnly}`;
      }
      return `+91${digitsOnly}`;
    }

    return trimmed;
  }

  /**
   * Masks email or phone number for safe display in client responses.
   */
  static maskIdentifier(normalizedIdentifier: string, channel: OtpChannel): string {
    if (channel === 'EMAIL') {
      const parts = normalizedIdentifier.split('@');
      if (parts.length !== 2) return '***@***.***';
      const local = parts[0] || '';
      const domain = parts[1] || '';
      if (local.length <= 2) {
        return `${local[0] || '*'}***@${domain}`;
      }
      return `${local.slice(0, 2)}***@${domain}`;
    }

    if (channel === 'MOBILE') {
      const clean = normalizedIdentifier.replace(/\D/g, '');
      if (clean.length >= 10) {
        const last3 = clean.slice(-3);
        const first4 = clean.slice(0, 4);
        return `+91 ${first4.slice(2)}*** **${last3}`;
      }
      return '+91 ***** *****';
    }

    return '***';
  }

  /**
   * Hashes destination identifier using SHA-256 for privacy-preserving storage & rate limiting.
   */
  static hashDestination(normalizedDestination: string): string {
    return crypto.createHash('sha256').update(normalizedDestination).digest('hex');
  }

  /**
   * Requests an OTP challenge and dispatches the code via Email (Resend).
   */
  static async requestOtp(params: {
    identifier: string;
    channel: OtpChannel;
    purpose: OtpPurpose;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{
    challengeId: string;
    channel: OtpChannel;
    destinationMasked: string;
    expiresIn: number;
    resendCooldown: number;
    message: string;
  }> {
    // 1. Purpose allowlist check
    if (!ALLOWED_OTP_PURPOSES.includes(params.purpose)) {
      throw ApiError.badRequest('Invalid or unsupported OTP purpose');
    }

    // 2. Canonical normalization
    const normalizedDestination = this.normalizeIdentifier(params.identifier, params.channel);
    if (!normalizedDestination) {
      throw ApiError.badRequest('A valid email or mobile number is required');
    }

    const destinationHash = this.hashDestination(normalizedDestination);
    const destinationMasked = this.maskIdentifier(normalizedDestination, params.channel);

    // 3. Rate limiting per destination
    const recentRequestsCount = await OtpRepository.countRecentRequests(
      destinationHash,
      Math.floor(env.OTP_REQUEST_RATE_LIMIT_WINDOW_MS / 1000)
    );

    if (recentRequestsCount >= env.OTP_REQUEST_RATE_LIMIT_MAX) {
      logger.warn('[OtpService] OTP request rate limit exceeded', {
        destinationMasked,
        channel: params.channel,
        ipAddress: params.ipAddress,
      });
      throw ApiError.tooManyRequests(
        'Too many verification requests for this identifier. Please try again after 15 minutes.'
      );
    }

    // 4. Account lookup and validation for LOGIN and PASSWORD_RESET purposes
    let resolvedUserId: number | null = null;

    if (params.purpose === 'LOGIN' || params.purpose === 'PASSWORD_RESET') {
      const user =
        params.channel === 'EMAIL'
          ? await UserRepository.findByEmail(normalizedDestination)
          : await UserRepository.findByPhone(normalizedDestination);

      if (!user) {
        // Anti-enumeration defense: Return generic success without dispatching email
        logger.info(`[OtpService] ${params.purpose} OTP requested for non-existent account (anti-enumeration)`, {
          destinationMasked,
          channel: params.channel,
        });
        const fakeChallengeId = uuidv4();
        return {
          challengeId: fakeChallengeId,
          channel: params.channel,
          destinationMasked,
          expiresIn: env.OTP_EXPIRATION_SECONDS,
          resendCooldown: env.OTP_RESEND_COOLDOWN_SECONDS,
          message: 'If the account is eligible, a verification code has been sent.',
        };
      }

      if (params.purpose === 'LOGIN') {
        // Role check: Only CLIENT users are permitted to log in via OTP
        const roles = await UserRepository.getUserRoles(user.id);
        const isClient = roles.includes(RoleName.CLIENT);
        const isAdmin = roles.includes(RoleName.ADMIN) || roles.includes(RoleName.SUPER_ADMIN);

        if (isAdmin && !isClient) {
          logger.warn('[OtpService] Admin user attempted OTP-only login (blocked)', {
            userId: user.id,
            email: user.email,
          });
          throw ApiError.forbidden(
            'Administrative staff must authenticate using password and administrative credentials.'
          );
        }
      }

      // Check account status
      if (user.status === 'SUSPENDED') {
        throw ApiError.forbidden('Your account has been suspended. Please contact customer support.');
      }
      if (user.status === 'DELETED') {
        throw ApiError.unauthorized('Invalid authentication request.');
      }

      resolvedUserId = user.id;
    }

    // 5. Invalidate previous pending challenges for this destination & purpose
    await OtpRepository.invalidatePreviousPending(destinationHash, params.purpose);

    // 6. Generate 6-digit OTP code & hash
    const otpCode = this.generateCode();
    const otpHash = this.hashCode(otpCode);

    // 7. Send OTP via active provider (Resend for Email)
    const provider = this.getProvider();
    await provider.sendOtp({
      destination: normalizedDestination,
      channel: params.channel,
      purpose: params.purpose,
      code: otpCode,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    // 8. Store challenge in DB with code hash
    const challengePublicId = uuidv4();
    const expiresAt = new Date(Date.now() + env.OTP_EXPIRATION_SECONDS * 1000);

    await OtpRepository.create({
      publicId: challengePublicId,
      userId: resolvedUserId,
      channel: params.channel,
      purpose: params.purpose,
      destinationHash,
      destinationMasked,
      provider: provider.name,
      providerRequestId: `code_hash:${otpHash}`,
      maxAttempts: env.OTP_MAX_ATTEMPTS,
      expiresAt,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    // 9. Audit logging (no plain OTP logged)
    await AuditService.log({
      userId: resolvedUserId,
      action: 'OTP_REQUESTED',
      entityType: 'AUTH',
      newValues: {
        channel: params.channel,
        purpose: params.purpose,
        destinationMasked,
        provider: provider.name,
      },
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    return {
      challengeId: challengePublicId,
      channel: params.channel,
      destinationMasked,
      expiresIn: env.OTP_EXPIRATION_SECONDS,
      resendCooldown: env.OTP_RESEND_COOLDOWN_SECONDS,
      message: `Verification code sent to ${destinationMasked}`,
    };
  }

  /**
   * Verifies an OTP code and authenticates the CLIENT user if purpose is LOGIN.
   */
  static async verifyOtp(params: {
    challengeId: string;
    otp: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{
    user?: AuthenticatedUser;
    tokens?: AuthTokens;
    rawRefreshToken?: string;
    message: string;
    verified: boolean;
  }> {
    if (!params.challengeId || !params.otp) {
      throw ApiError.badRequest('Challenge ID and verification code are required.');
    }

    const challenge = await OtpRepository.findByPublicId(params.challengeId);

    if (!challenge) {
      throw ApiError.badRequest('Invalid or expired verification session. Please request a new code.');
    }

    // Check challenge status
    if (challenge.status === 'VERIFIED') {
      throw ApiError.badRequest('This verification code has already been used.');
    }

    if (challenge.status === 'BLOCKED') {
      throw ApiError.badRequest(
        'This verification session has been blocked due to too many failed attempts. Please request a new code.'
      );
    }

    if (challenge.status === 'CANCELLED' || challenge.status === 'EXPIRED') {
      throw ApiError.badRequest('This verification session is no longer active. Please request a new code.');
    }

    // Check expiration
    const now = new Date();
    if (now > new Date(challenge.expires_at)) {
      await OtpRepository.markStatus(challenge.id, 'EXPIRED');
      await AuditService.log({
        userId: challenge.user_id,
        action: 'OTP_EXPIRED',
        entityType: 'AUTH',
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      });
      throw ApiError.badRequest('Verification code has expired. Please request a new code.');
    }

    // Check attempt limits
    if (challenge.attempts >= challenge.max_attempts) {
      await OtpRepository.markStatus(challenge.id, 'BLOCKED');
      await AuditService.log({
        userId: challenge.user_id,
        action: 'OTP_BLOCKED',
        entityType: 'AUTH',
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      });
      throw ApiError.badRequest(
        'Maximum verification attempts exceeded. Please request a new verification code.'
      );
    }

    // Verify candidate OTP code using timing-safe hash comparison
    const candidateHash = this.hashCode(params.otp);
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

    // Handle invalid OTP
    if (!isValid) {
      const updatedAttempts = await OtpRepository.incrementAttempts(challenge.id);
      const remainingAttempts = Math.max(0, challenge.max_attempts - updatedAttempts);

      if (updatedAttempts >= challenge.max_attempts) {
        await OtpRepository.markStatus(challenge.id, 'BLOCKED');
        await AuditService.log({
          userId: challenge.user_id,
          action: 'OTP_CHALLENGE_BLOCKED',
          entityType: 'AUTH',
          newValues: { attempts: updatedAttempts },
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
        });
        throw ApiError.badRequest(
          'Maximum verification attempts exceeded. This session is now blocked.'
        );
      }

      await AuditService.log({
        userId: challenge.user_id,
        action: 'OTP_VERIFICATION_FAILED',
        entityType: 'AUTH',
        newValues: { attempts: updatedAttempts, remainingAttempts },
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      });

      throw ApiError.badRequest(
        `Invalid verification code. ${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining.`
      );
    }

    // Mark challenge verified
    await OtpRepository.markVerified(challenge.id);

    await AuditService.log({
      userId: challenge.user_id,
      action: 'OTP_VERIFICATION_SUCCESS',
      entityType: 'AUTH',
      newValues: { channel: challenge.channel, purpose: challenge.purpose },
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    // If purpose is LOGIN: Authenticate and issue application JWT tokens
    if (challenge.purpose === 'LOGIN') {
      if (!challenge.user_id) {
        throw ApiError.badRequest('No client account associated with this verification session.');
      }

      const userRecord = await UserRepository.findById(challenge.user_id);
      if (!userRecord || userRecord.status !== 'ACTIVE') {
        throw ApiError.unauthorized('Account is not active or has been removed.');
      }

      // Role check: Strictly verify user is a CLIENT
      const roles = await UserRepository.getUserRoles(userRecord.id);
      if (!roles.includes(RoleName.CLIENT)) {
        logger.warn('[OtpService] Non-client account attempted OTP login completion (blocked)', {
          userId: userRecord.id,
          roles,
        });
        throw ApiError.forbidden(
          'Administrative staff must authenticate using password and administrative credentials.'
        );
      }

      // Mark email or phone verified independently
      if (challenge.channel === 'EMAIL' && !userRecord.email_verified_at) {
        await UserRepository.markEmailVerified(userRecord.id);
      } else if (challenge.channel === 'MOBILE' && !userRecord.phone_verified_at) {
        await UserRepository.markPhoneVerified(userRecord.id);
      }

      // Update last login timestamp
      await UserRepository.updateLastLogin(userRecord.id);

      // Fetch permissions and client profile
      const permissions = await UserRepository.getUserPermissions(userRecord.id);
      const clientRecord = await ClientRepository.findByUserId(userRecord.id);

      // Issue tokens using TokenUtil
      const { tokens, rawRefreshToken } = TokenUtil.generateAuthTokens({
        userId: userRecord.id,
        publicId: userRecord.public_id,
        email: userRecord.email,
        roles,
        permissions,
        clientId: clientRecord?.id,
        clientPublicId: clientRecord?.public_id,
      });

      await AuditService.log({
        userId: userRecord.id,
        action: 'LOGIN_SUCCESS',
        entityType: 'AUTH',
        newValues: { method: `OTP_${challenge.channel}` },
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

      return {
        user,
        tokens,
        rawRefreshToken,
        verified: true,
        message: 'Successfully authenticated.',
      };
    }

    // Purpose: VERIFY_EMAIL or VERIFY_MOBILE
    if (challenge.purpose === 'VERIFY_EMAIL' && challenge.user_id) {
      await UserRepository.markEmailVerified(challenge.user_id);
    } else if (challenge.purpose === 'VERIFY_MOBILE' && challenge.user_id) {
      await UserRepository.markPhoneVerified(challenge.user_id);
    }

    return {
      verified: true,
      message: 'Verification completed successfully.',
    };
  }

  /**
   * Resends an OTP code with cooldown and maximum resend enforcement.
   */
  static async resendOtp(params: {
    challengeId: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{
    success: boolean;
    message: string;
    resendCooldown: number;
  }> {
    const challenge = await OtpRepository.findByPublicId(params.challengeId);

    if (!challenge) {
      throw ApiError.badRequest('Invalid verification session. Please request a new code.');
    }

    if (challenge.status !== 'PENDING') {
      throw ApiError.badRequest('This verification session is no longer active. Please request a new code.');
    }

    // Check expiration
    const now = Date.now();
    if (now > new Date(challenge.expires_at).getTime()) {
      await OtpRepository.markStatus(challenge.id, 'EXPIRED');
      throw ApiError.badRequest('Verification session has expired. Please request a new code.');
    }

    // Check resend count limit
    if (challenge.resend_count >= env.OTP_MAX_RESENDS) {
      throw ApiError.badRequest('Maximum resend limit reached for this session. Please request a new code.');
    }

    // Check resend cooldown
    if (challenge.last_resend_at) {
      const lastResendTime = new Date(challenge.last_resend_at).getTime();
      const elapsedSeconds = Math.floor((now - lastResendTime) / 1000);
      const remainingCooldown = env.OTP_RESEND_COOLDOWN_SECONDS - elapsedSeconds;

      if (remainingCooldown > 0) {
        throw ApiError.badRequest(
          `Please wait ${remainingCooldown} seconds before requesting another code.`
        );
      }
    } else {
      const createdTime = new Date(challenge.created_at).getTime();
      const elapsedSeconds = Math.floor((now - createdTime) / 1000);
      const remainingCooldown = env.OTP_RESEND_COOLDOWN_SECONDS - elapsedSeconds;

      if (remainingCooldown > 0) {
        throw ApiError.badRequest(
          `Please wait ${remainingCooldown} seconds before requesting another code.`
        );
      }
    }

    // Find destination
    let destination = '';
    if (challenge.user_id) {
      const user = await UserRepository.findById(challenge.user_id);
      if (user) {
        destination = challenge.channel === 'EMAIL' ? user.email : user.phone || '';
      }
    }

    if (!destination) {
      throw ApiError.badRequest('Unable to resolve delivery destination for resend.');
    }

    // Generate fresh 6-digit code
    const newOtpCode = this.generateCode();
    const newOtpHash = this.hashCode(newOtpCode);

    // Send new OTP
    const provider = this.getProvider();
    await provider.sendOtp({
      destination,
      channel: challenge.channel,
      purpose: challenge.purpose,
      code: newOtpCode,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    // Update challenge with new hash and increment resends
    await OtpRepository.incrementResends(challenge.id);
    await OtpRepository.updateProviderRequestId(challenge.id, `code_hash:${newOtpHash}`);

    await AuditService.log({
      userId: challenge.user_id,
      action: 'OTP_RESENT',
      entityType: 'AUTH',
      newValues: {
        channel: challenge.channel,
        resendCount: challenge.resend_count + 1,
      },
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    return {
      success: true,
      message: `A fresh verification code has been dispatched to ${challenge.destination_masked}.`,
      resendCooldown: env.OTP_RESEND_COOLDOWN_SECONDS,
    };
  }
}
