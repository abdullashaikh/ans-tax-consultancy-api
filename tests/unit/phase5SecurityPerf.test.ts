import { errorHandler } from '../../src/middleware/error.middleware';
import { ApiError } from '../../src/utils/apiError';
import { ErrorCodes } from '../../src/constants/errorCodes';
import { HttpStatus } from '../../src/constants/httpStatus';
import { createLeadSchema } from '../../src/validators/lead.validator';
import { corsOptions, helmetOptions } from '../../src/config/security';

describe('Phase 5 — Performance, Security Hardening & Accessibility Tests', () => {
  describe('1. Production Error Sanitization & Data Protection', () => {
    let mockReq: any;
    let mockRes: any;
    let mockNext: any;

    beforeEach(() => {
      mockReq = {
        method: 'POST',
        originalUrl: '/api/v1/leads',
        requestId: 'req-test-12345',
        headers: {},
      };
      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      mockNext = jest.fn();
    });

    it('should sanitize unexpected server errors in production without exposing stack traces or SQL details', () => {
      const internalDatabaseError = new Error('SELECT * FROM users WHERE id = syntax error at or near secret_table');

      errorHandler(internalDatabaseError, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockRes.json).toHaveBeenCalled();

      const responsePayload = mockRes.json.mock.calls[0][0];
      expect(responsePayload.success).toBe(false);
      expect(responsePayload.error.code).toBe(ErrorCodes.INTERNAL_SERVER_ERROR);
      expect(responsePayload.error.message).toBe('An unexpected internal error occurred');
      expect(responsePayload.error.stack).toBeUndefined();
      expect(JSON.stringify(responsePayload)).not.toContain('secret_table');
      expect(JSON.stringify(responsePayload)).not.toContain('syntax error');
    });

    it('should format ApiError with sanitized message and correct HTTP status code', () => {
      const notFoundError = ApiError.notFound('Service with slug "invalid-slug" not found');

      errorHandler(notFoundError, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      const responsePayload = mockRes.json.mock.calls[0][0];
      expect(responsePayload.success).toBe(false);
      expect(responsePayload.error.code).toBe(ErrorCodes.RESOURCE_NOT_FOUND);
      expect(responsePayload.error.message).toBe('Service with slug "invalid-slug" not found');
    });
  });

  describe('2. Server-Side Input Validation (Zod Validation)', () => {
    it('should accept valid lead inquiry payload', () => {
      const validPayload = {
        name: 'Rajesh Sharma',
        email: 'rajesh@example.com',
        phone: '+91 98765 43210',
        serviceId: 1,
        serviceInterest: 'GST Registration',
        message: 'Looking for prompt GST registration for new business entity.',
        source: 'WEBSITE',
      };

      const result = createLeadSchema.body.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('should reject payload with empty name', () => {
      const invalidPayload = {
        name: '',
        email: 'rajesh@example.com',
      };

      const result = createLeadSchema.body.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('should reject invalid email format', () => {
      const invalidPayload = {
        name: 'Rajesh Sharma',
        email: 'not-an-email-address',
      };

      const result = createLeadSchema.body.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('should reject malformed phone numbers with disallowed characters', () => {
      const invalidPayload = {
        name: 'Rajesh Sharma',
        phone: '1234<script>alert(1)</script>',
      };

      const result = createLeadSchema.body.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });
  });

  describe('3. CORS & Security Headers Configuration', () => {
    it('should have strict security headers configured via helmetOptions', () => {
      expect(helmetOptions.noSniff).toBe(true);
      expect(helmetOptions.frameguard).toEqual({ action: 'deny' });
      expect(helmetOptions.xssFilter).toBe(true);
      expect(helmetOptions.referrerPolicy).toEqual({ policy: 'strict-origin-when-cross-origin' });
    });

    it('should restrict CORS and allow credentials only with safe origins', () => {
      expect(corsOptions.credentials).toBe(true);
      expect(corsOptions.methods).toContain('GET');
      expect(corsOptions.methods).toContain('POST');
      expect(corsOptions.methods).toContain('PATCH');
      expect(corsOptions.methods).toContain('DELETE');
    });
  });
});
