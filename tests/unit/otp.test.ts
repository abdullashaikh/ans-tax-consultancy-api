import { OtpService } from '../../src/services/otp/otp.service';
import { MockOtpProvider } from '../../src/services/otp/mockOtpProvider';
import { ALLOWED_OTP_PURPOSES } from '../../src/services/otp/otpProvider.interface';
import { OtpRepository } from '../../src/repositories/otp.repository';
import { UserRepository } from '../../src/repositories/user.repository';
import { RoleName } from '../../src/constants/roles';

describe('OTP Service - Unit Tests', () => {
  let mockProvider: MockOtpProvider;

  beforeEach(() => {
    mockProvider = new MockOtpProvider();
    OtpService.setProvider(mockProvider);
    jest.clearAllMocks();
  });

  afterEach(() => {
    mockProvider.clear();
  });

  describe('Identifier Normalization', () => {
    it('normalizes email addresses by trimming and lowercasing', () => {
      expect(OtpService.normalizeIdentifier('  User@Example.COM  ', 'EMAIL')).toBe('user@example.com');
      expect(OtpService.normalizeIdentifier('Rahul.Sharma+Tax@GMAIL.com', 'EMAIL')).toBe(
        'rahul.sharma+tax@gmail.com'
      );
    });

    it('normalizes Indian 10-digit mobile numbers to E.164 (+91)', () => {
      expect(OtpService.normalizeIdentifier('9876543210', 'MOBILE')).toBe('+919876543210');
      expect(OtpService.normalizeIdentifier('98765 43210', 'MOBILE')).toBe('+919876543210');
      expect(OtpService.normalizeIdentifier('98765-43210', 'MOBILE')).toBe('+919876543210');
    });

    it('handles mobile numbers with leading 0 or +91 prefix', () => {
      expect(OtpService.normalizeIdentifier('09876543210', 'MOBILE')).toBe('+919876543210');
      expect(OtpService.normalizeIdentifier('+91 9876543210', 'MOBILE')).toBe('+919876543210');
      expect(OtpService.normalizeIdentifier('919876543210', 'MOBILE')).toBe('+919876543210');
    });
  });

  describe('Identifier Masking for Client Display', () => {
    it('masks email addresses safely', () => {
      expect(OtpService.maskIdentifier('rahul.sharma@example.com', 'EMAIL')).toBe('ra***@example.com');
      expect(OtpService.maskIdentifier('a@b.com', 'EMAIL')).toBe('a***@b.com');
    });

    it('masks mobile phone numbers safely', () => {
      expect(OtpService.maskIdentifier('+919876543210', 'MOBILE')).toBe('+91 98*** **210');
    });
  });

  describe('Destination Hashing', () => {
    it('generates a 64-character SHA-256 hex string', () => {
      const hash = OtpService.hashDestination('user@example.com');
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
      // Deterministic check
      expect(OtpService.hashDestination('user@example.com')).toBe(hash);
    });
  });

  describe('Purpose Allowlist', () => {
    it('contains all permitted statutory and authentication purposes', () => {
      expect(ALLOWED_OTP_PURPOSES).toContain('LOGIN');
      expect(ALLOWED_OTP_PURPOSES).toContain('REGISTRATION');
      expect(ALLOWED_OTP_PURPOSES).toContain('VERIFY_EMAIL');
      expect(ALLOWED_OTP_PURPOSES).toContain('VERIFY_MOBILE');
      expect(ALLOWED_OTP_PURPOSES).toContain('PASSWORD_RESET');
      expect(ALLOWED_OTP_PURPOSES).toContain('CHANGE_EMAIL');
      expect(ALLOWED_OTP_PURPOSES).toContain('CHANGE_MOBILE');
      expect(ALLOWED_OTP_PURPOSES).toContain('STEP_UP_AUTH');
    });
  });

  describe('Anti-Enumeration Defense on Login OTP Request', () => {
    it('returns a generic success response without calling provider when account does not exist', async () => {
      jest.spyOn(OtpRepository, 'countRecentRequests').mockResolvedValue(0);
      jest.spyOn(UserRepository, 'findByEmail').mockResolvedValue(null);

      const result = await OtpService.requestOtp({
        identifier: 'nonexistent@example.com',
        channel: 'EMAIL',
        purpose: 'LOGIN',
      });

      expect(result.message).toBe('If the account is eligible, a verification code has been sent.');
      expect(result.destinationMasked).toBe('no***@example.com');
      expect(mockProvider.sentOtps).toHaveLength(0); // Provider was not triggered
    });
  });

  describe('Admin Role Protection', () => {
    it('blocks admin accounts from OTP-only login', async () => {
      jest.spyOn(OtpRepository, 'countRecentRequests').mockResolvedValue(0);
      jest.spyOn(UserRepository, 'findByEmail').mockResolvedValue({
        id: 1,
        public_id: 'usr-admin-01',
        first_name: 'Admin',
        last_name: 'User',
        email: 'admin@anstaxconsultancy.com',
        password_hash: 'hash',
        phone: null,
        status: 'ACTIVE',
        email_verified_at: new Date(),
        phone_verified_at: null,
        last_login_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      });
      jest.spyOn(UserRepository, 'getUserRoles').mockResolvedValue([RoleName.ADMIN]);

      await expect(
        OtpService.requestOtp({
          identifier: 'admin@anstaxconsultancy.com',
          channel: 'EMAIL',
          purpose: 'LOGIN',
        })
      ).rejects.toThrow('Administrative staff must authenticate using password and administrative credentials.');
    });
  });

  describe('OTP Verification Attempt Limits & Blocking', () => {
    it('increments attempts on invalid OTP and blocks on 5 failed attempts', async () => {
      const mockChallenge = {
        id: 101,
        public_id: 'chall-uuid-101',
        user_id: 5,
        channel: 'EMAIL' as const,
        purpose: 'LOGIN' as const,
        destination_hash: 'hash',
        destination_masked: 'ra***@example.com',
        provider: 'RESEND',
        provider_request_id: `code_hash:${OtpService.hashCode('654321')}`,
        status: 'PENDING' as const,
        attempts: 4,
        max_attempts: 5,
        resend_count: 0,
        last_resend_at: null,
        expires_at: new Date(Date.now() + 300000),
        verified_at: null,
        ip_address: '127.0.0.1',
        user_agent: 'Jest',
        created_at: new Date(),
        updated_at: new Date(),
      };

      jest.spyOn(OtpRepository, 'findByPublicId').mockResolvedValue(mockChallenge);
      jest.spyOn(OtpRepository, 'incrementAttempts').mockResolvedValue(5);
      const markStatusSpy = jest.spyOn(OtpRepository, 'markStatus').mockResolvedValue();

      await expect(
        OtpService.verifyOtp({
          challengeId: 'chall-uuid-101',
          otp: '000000', // Incorrect OTP
        })
      ).rejects.toThrow('Maximum verification attempts exceeded. This session is now blocked.');

      expect(markStatusSpy).toHaveBeenCalledWith(101, 'BLOCKED');
    });

    it('rejects expired OTP challenges', async () => {
      const mockChallenge = {
        id: 102,
        public_id: 'chall-uuid-102',
        user_id: 5,
        channel: 'EMAIL' as const,
        purpose: 'LOGIN' as const,
        destination_hash: 'hash',
        destination_masked: 'ra***@example.com',
        provider: 'RESEND',
        provider_request_id: `code_hash:${OtpService.hashCode('123456')}`,
        status: 'PENDING' as const,
        attempts: 0,
        max_attempts: 5,
        resend_count: 0,
        last_resend_at: null,
        expires_at: new Date(Date.now() - 5000), // Expired 5 seconds ago
        verified_at: null,
        ip_address: '127.0.0.1',
        user_agent: 'Jest',
        created_at: new Date(Date.now() - 305000),
        updated_at: new Date(),
      };

      jest.spyOn(OtpRepository, 'findByPublicId').mockResolvedValue(mockChallenge);
      const markStatusSpy = jest.spyOn(OtpRepository, 'markStatus').mockResolvedValue();

      await expect(
        OtpService.verifyOtp({
          challengeId: 'chall-uuid-102',
          otp: '123456',
        })
      ).rejects.toThrow('Verification code has expired. Please request a new code.');

      expect(markStatusSpy).toHaveBeenCalledWith(102, 'EXPIRED');
    });

    it('rejects re-verification replay attempts on already used challenge', async () => {
      const mockChallenge = {
        id: 106,
        public_id: 'chall-uuid-106',
        user_id: 5,
        channel: 'EMAIL' as const,
        purpose: 'LOGIN' as const,
        destination_hash: 'hash',
        destination_masked: 'ra***@example.com',
        provider: 'RESEND',
        provider_request_id: `code_hash:${OtpService.hashCode('123456')}`,
        status: 'VERIFIED' as const,
        attempts: 0,
        max_attempts: 5,
        resend_count: 0,
        last_resend_at: null,
        expires_at: new Date(Date.now() + 300000),
        verified_at: new Date(),
        ip_address: '127.0.0.1',
        user_agent: 'Jest',
        created_at: new Date(),
        updated_at: new Date(),
      };

      jest.spyOn(OtpRepository, 'findByPublicId').mockResolvedValue(mockChallenge);

      await expect(
        OtpService.verifyOtp({
          challengeId: 'chall-uuid-106',
          otp: '123456',
        })
      ).rejects.toThrow('This verification code has already been used.');
    });
  });

  describe('Resend Cooldown & Max Resends', () => {
    it('enforces a 30-second cooldown on OTP resend', async () => {
      const mockChallenge = {
        id: 103,
        public_id: 'chall-uuid-103',
        user_id: 5,
        channel: 'EMAIL' as const,
        purpose: 'LOGIN' as const,
        destination_hash: 'hash',
        destination_masked: 'ra***@example.com',
        provider: 'RESEND',
        provider_request_id: `code_hash:${OtpService.hashCode('123456')}`,
        status: 'PENDING' as const,
        attempts: 0,
        max_attempts: 5,
        resend_count: 1,
        last_resend_at: new Date(Date.now() - 10000), // Resent 10 seconds ago (cooldown is 30s)
        expires_at: new Date(Date.now() + 250000),
        verified_at: null,
        ip_address: '127.0.0.1',
        user_agent: 'Jest',
        created_at: new Date(),
        updated_at: new Date(),
      };

      jest.spyOn(OtpRepository, 'findByPublicId').mockResolvedValue(mockChallenge);

      await expect(
        OtpService.resendOtp({
          challengeId: 'chall-uuid-103',
        })
      ).rejects.toThrow(/Please wait \d+ seconds before requesting another code/);
    });

    it('enforces a maximum of 3 resends per challenge', async () => {
      const mockChallenge = {
        id: 104,
        public_id: 'chall-uuid-104',
        user_id: 5,
        channel: 'EMAIL' as const,
        purpose: 'LOGIN' as const,
        destination_hash: 'hash',
        destination_masked: 'ra***@example.com',
        provider: 'RESEND',
        provider_request_id: `code_hash:${OtpService.hashCode('123456')}`,
        status: 'PENDING' as const,
        attempts: 0,
        max_attempts: 5,
        resend_count: 3, // Already reached max resends
        last_resend_at: new Date(Date.now() - 40000),
        expires_at: new Date(Date.now() + 200000),
        verified_at: null,
        ip_address: '127.0.0.1',
        user_agent: 'Jest',
        created_at: new Date(),
        updated_at: new Date(),
      };

      jest.spyOn(OtpRepository, 'findByPublicId').mockResolvedValue(mockChallenge);

      await expect(
        OtpService.resendOtp({
          challengeId: 'chall-uuid-104',
        })
      ).rejects.toThrow('Maximum resend limit reached for this session. Please request a new code.');
    });
  });
});
