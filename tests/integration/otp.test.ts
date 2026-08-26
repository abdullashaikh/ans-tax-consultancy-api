import request from 'supertest';
import { createApp } from '../../src/app';
import { OtpService } from '../../src/services/otp/otp.service';
import { MockOtpProvider } from '../../src/services/otp/mockOtpProvider';
import { OtpRepository } from '../../src/repositories/otp.repository';
import { UserRepository } from '../../src/repositories/user.repository';
import { ClientRepository } from '../../src/repositories/client.repository';
import { RoleName } from '../../src/constants/roles';

const app = createApp();

describe('OTP Authentication Endpoints - Integration Tests', () => {
  let mockProvider: MockOtpProvider;

  beforeEach(() => {
    mockProvider = new MockOtpProvider();
    OtpService.setProvider(mockProvider);
    jest.clearAllMocks();
  });

  afterEach(() => {
    mockProvider.clear();
  });

  describe('POST /api/v1/auth/otp/request', () => {
    it('validates request payload and rejects invalid email format', async () => {
      const res = await request(app)
        .post('/api/v1/auth/otp/request')
        .send({
          identifier: 'not-an-email',
          channel: 'EMAIL',
          purpose: 'LOGIN',
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('validates request payload and rejects invalid mobile length', async () => {
      const res = await request(app)
        .post('/api/v1/auth/otp/request')
        .send({
          identifier: '12345',
          channel: 'MOBILE',
          purpose: 'LOGIN',
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it('rejects unauthorized or arbitrary OTP purposes', async () => {
      const res = await request(app)
        .post('/api/v1/auth/otp/request')
        .send({
          identifier: 'user@example.com',
          channel: 'EMAIL',
          purpose: 'ARBITRARY_HACK_PURPOSE',
        });

      expect(res.status).toBe(422);
    });

    it('successfully requests Email OTP for registered client', async () => {
      jest.spyOn(OtpRepository, 'countRecentRequests').mockResolvedValue(0);
      jest.spyOn(OtpRepository, 'invalidatePreviousPending').mockResolvedValue();
      jest.spyOn(OtpRepository, 'create').mockResolvedValue(1);
      jest.spyOn(UserRepository, 'findByEmail').mockResolvedValue({
        id: 10,
        public_id: 'usr-client-10',
        first_name: 'Rahul',
        last_name: 'Sharma',
        email: 'rahul@example.com',
        phone: '+919876543210',
        password_hash: 'hash',
        status: 'ACTIVE',
        email_verified_at: new Date(),
        phone_verified_at: new Date(),
        last_login_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      });
      jest.spyOn(UserRepository, 'getUserRoles').mockResolvedValue([RoleName.CLIENT]);

      const res = await request(app)
        .post('/api/v1/auth/otp/request')
        .send({
          identifier: 'rahul@example.com',
          channel: 'EMAIL',
          purpose: 'LOGIN',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.challengeId).toBeDefined();
      expect(res.body.data.channel).toBe('EMAIL');
      expect(res.body.data.destinationMasked).toBe('ra***@example.com');
      expect(res.body.data.expiresIn).toBe(300);
      expect(res.body.data.resendCooldown).toBe(30);
    });

    it('successfully requests Mobile OTP for registered client (+91)', async () => {
      jest.spyOn(OtpRepository, 'countRecentRequests').mockResolvedValue(0);
      jest.spyOn(OtpRepository, 'invalidatePreviousPending').mockResolvedValue();
      jest.spyOn(OtpRepository, 'create').mockResolvedValue(2);
      jest.spyOn(UserRepository, 'findByPhone').mockResolvedValue({
        id: 10,
        public_id: 'usr-client-10',
        first_name: 'Rahul',
        last_name: 'Sharma',
        email: 'rahul@example.com',
        phone: '+919876543210',
        password_hash: 'hash',
        status: 'ACTIVE',
        email_verified_at: new Date(),
        phone_verified_at: new Date(),
        last_login_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      });
      jest.spyOn(UserRepository, 'getUserRoles').mockResolvedValue([RoleName.CLIENT]);

      const res = await request(app)
        .post('/api/v1/auth/otp/request')
        .send({
          identifier: '9876543210',
          channel: 'MOBILE',
          purpose: 'LOGIN',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.challengeId).toBeDefined();
      expect(res.body.data.channel).toBe('MOBILE');
      expect(res.body.data.destinationMasked).toBe('+91 98*** **210');
    });
  });

  describe('POST /api/v1/auth/otp/verify', () => {
    it('successfully verifies OTP and issues tokens for LOGIN', async () => {
      const mockChallenge = {
        id: 201,
        public_id: 'chall-uuid-201',
        user_id: 10,
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
        expires_at: new Date(Date.now() + 300000),
        verified_at: null,
        ip_address: '127.0.0.1',
        user_agent: 'Jest',
        created_at: new Date(),
        updated_at: new Date(),
      };

      jest.spyOn(OtpRepository, 'findByPublicId').mockResolvedValue(mockChallenge);
      jest.spyOn(OtpRepository, 'markVerified').mockResolvedValue();
      jest.spyOn(UserRepository, 'findById').mockResolvedValue({
        id: 10,
        public_id: 'usr-client-10',
        first_name: 'Rahul',
        last_name: 'Sharma',
        email: 'rahul@example.com',
        phone: '+919876543210',
        password_hash: 'hash',
        status: 'ACTIVE',
        email_verified_at: new Date(),
        phone_verified_at: null,
        last_login_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      });
      jest.spyOn(UserRepository, 'markPhoneVerified').mockResolvedValue();
      jest.spyOn(UserRepository, 'updateLastLogin').mockResolvedValue();
      jest.spyOn(UserRepository, 'getUserRoles').mockResolvedValue([RoleName.CLIENT]);
      jest.spyOn(UserRepository, 'getUserPermissions').mockResolvedValue([]);
      jest.spyOn(ClientRepository, 'findByUserId').mockResolvedValue({
        id: 1,
        public_id: 'cli-01',
        user_id: 10,
        client_type: 'INDIVIDUAL',
        legal_name: 'Rahul Sharma',
        display_name: 'Rahul Sharma',
        email: 'rahul@example.com',
        phone: '+919876543210',
        alternate_phone: null,
        business_type: null,
        pan_reference: 'ABCDE1234F',
        gstin: null,
        status: 'ACTIVE',
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      });

      const res = await request(app)
        .post('/api/v1/auth/otp/verify')
        .send({
          challengeId: '4440c925-0d98-4641-9cb2-689b36b46538',
          otp: '123456',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.verified).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.email).toBe('rahul@example.com');
      // Cookie was set
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('rejects invalid OTP and increments attempt counter', async () => {
      const mockChallenge = {
        id: 202,
        public_id: 'chall-uuid-202',
        user_id: 10,
        channel: 'EMAIL' as const,
        purpose: 'LOGIN' as const,
        destination_hash: 'hash',
        destination_masked: 'ra***@example.com',
        provider: 'RESEND',
        provider_request_id: `code_hash:${OtpService.hashCode('123456')}`,
        status: 'PENDING' as const,
        attempts: 1,
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
      jest.spyOn(OtpRepository, 'incrementAttempts').mockResolvedValue(2);

      const res = await request(app)
        .post('/api/v1/auth/otp/verify')
        .send({
          challengeId: '4440c925-0d98-4641-9cb2-689b36b46538',
          otp: '999999', // Wrong OTP
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('3 attempts remaining');
    });

    it('rejects login completion if user does not have CLIENT role (e.g. ADMIN trying OTP)', async () => {
      const mockChallenge = {
        id: 204,
        public_id: 'chall-uuid-204',
        user_id: 2,
        channel: 'EMAIL' as const,
        purpose: 'LOGIN' as const,
        destination_hash: 'hash',
        destination_masked: 'ad***@example.com',
        provider: 'RESEND',
        provider_request_id: `code_hash:${OtpService.hashCode('123456')}`,
        status: 'PENDING' as const,
        attempts: 0,
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
      jest.spyOn(OtpRepository, 'markVerified').mockResolvedValue();
      jest.spyOn(UserRepository, 'findById').mockResolvedValue({
        id: 2,
        public_id: 'usr-admin-02',
        first_name: 'Admin',
        last_name: 'Staff',
        email: 'admin@anstaxconsultancy.com',
        phone: '+917041512939',
        password_hash: 'hash',
        status: 'ACTIVE',
        email_verified_at: new Date(),
        phone_verified_at: new Date(),
        last_login_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      });
      jest.spyOn(UserRepository, 'getUserRoles').mockResolvedValue([RoleName.ADMIN]); // Only ADMIN role, not CLIENT

      const res = await request(app)
        .post('/api/v1/auth/otp/verify')
        .send({
          challengeId: '4440c925-0d98-4641-9cb2-689b36b46538',
          otp: '123456',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Administrative staff must authenticate using password');
    });

    it('rejects login completion if account is not active', async () => {
      const mockChallenge = {
        id: 205,
        public_id: 'chall-uuid-205',
        user_id: 3,
        channel: 'EMAIL' as const,
        purpose: 'LOGIN' as const,
        destination_hash: 'hash',
        destination_masked: 'cl***@example.com',
        provider: 'RESEND',
        provider_request_id: `code_hash:${OtpService.hashCode('123456')}`,
        status: 'PENDING' as const,
        attempts: 0,
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
      jest.spyOn(UserRepository, 'findById').mockResolvedValue({
        id: 3,
        public_id: 'usr-client-03',
        first_name: 'Suspended',
        last_name: 'User',
        email: 'suspended@example.com',
        phone: '+919876543210',
        password_hash: 'hash',
        status: 'SUSPENDED',
        email_verified_at: new Date(),
        phone_verified_at: new Date(),
        last_login_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      });

      const res = await request(app)
        .post('/api/v1/auth/otp/verify')
        .send({
          challengeId: '4440c925-0d98-4641-9cb2-689b36b46538',
          otp: '123456',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/otp/resend', () => {
    it('successfully resends OTP when cooldown has elapsed', async () => {
      const mockChallenge = {
        id: 203,
        public_id: 'chall-uuid-203',
        user_id: 10,
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
        expires_at: new Date(Date.now() + 300000),
        verified_at: null,
        ip_address: '127.0.0.1',
        user_agent: 'Jest',
        created_at: new Date(Date.now() - 40000),
        updated_at: new Date(),
      };

      jest.spyOn(OtpRepository, 'findByPublicId').mockResolvedValue(mockChallenge);
      jest.spyOn(OtpRepository, 'incrementResends').mockResolvedValue(1);
      jest.spyOn(OtpRepository, 'updateProviderRequestId').mockResolvedValue();
      jest.spyOn(UserRepository, 'findById').mockResolvedValue({
        id: 10,
        public_id: 'usr-client-10',
        first_name: 'Rahul',
        last_name: 'Sharma',
        email: 'rahul@example.com',
        phone: '+919876543210',
        password_hash: 'hash',
        status: 'ACTIVE',
        email_verified_at: new Date(),
        phone_verified_at: new Date(),
        last_login_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      });

      const res = await request(app)
        .post('/api/v1/auth/otp/resend')
        .send({
          challengeId: '4440c925-0d98-4641-9cb2-689b36b46538',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.resendCooldown).toBe(30);
    });
  });
});
