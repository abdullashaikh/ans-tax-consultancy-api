import { z } from 'zod';

export const registerSchema = {
  body: z.object({
    firstName: z.string().min(1, 'First name is required').max(100),
    lastName: z.string().min(1, 'Last name is required').max(100),
    email: z.string().email('Invalid email address').max(255).toLowerCase(),
    phone: z.string().regex(/^[0-9+\-\s()]{7,20}$/, 'Invalid phone number format').optional(),
    password: z.string().min(8, 'Password must be at least 8 characters long').max(100),
    clientType: z.enum(['INDIVIDUAL', 'BUSINESS']).default('INDIVIDUAL'),
    businessName: z.string().max(255).optional(),
  }),
};

export const loginSchema = {
  body: z.object({
    email: z.string().email('Invalid email address').toLowerCase(),
    password: z.string().min(1, 'Password is required'),
  }),
};

export const refreshTokenSchema = {
  body: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required').optional(),
  }),
};

export const forgotPasswordSchema = {
  body: z.object({
    email: z.string().email('Invalid email address').toLowerCase(),
  }),
};

export const resetPasswordSchema = {
  body: z
    .object({
      token: z.string().optional(),
      challengeId: z.string().optional(),
      otp: z.string().optional(),
      newPassword: z.string().min(8, 'Password must be at least 8 characters long').max(100),
    })
    .refine((data) => !!data.token || (!!data.challengeId && !!data.otp), {
      message: 'Either a reset token or challengeId and OTP code is required',
    }),
};

export const changePasswordSchema = {
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters long').max(100),
  }),
};

export const verifyEmailSchema = {
  body: z.object({
    token: z.string().min(1, 'Verification token is required'),
  }),
};

export const otpRequestSchema = {
  body: z
    .object({
      identifier: z.string().min(3, 'Email or mobile number is required').max(255),
      channel: z.enum(['EMAIL', 'MOBILE']).default('EMAIL'),
      purpose: z
        .enum([
          'LOGIN',
          'REGISTRATION',
          'VERIFY_EMAIL',
          'VERIFY_MOBILE',
          'PASSWORD_RESET',
          'CHANGE_EMAIL',
          'CHANGE_MOBILE',
          'STEP_UP_AUTH',
        ])
        .default('LOGIN'),
    })
    .superRefine((data, ctx) => {
      if (data.channel === 'EMAIL') {
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(data.identifier.trim())) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['identifier'],
            message: 'Please provide a valid email address',
          });
        }
      } else if (data.channel === 'MOBILE') {
        const digits = data.identifier.replace(/\D/g, '');
        if (digits.length < 10 || digits.length > 13) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['identifier'],
            message: 'Please provide a valid 10-digit mobile number (+91)',
          });
        }
      }
    }),
};

export const otpVerifySchema = {
  body: z.object({
    challengeId: z.string().uuid('Invalid verification session ID'),
    otp: z
      .string()
      .min(4, 'Verification code must be at least 4 digits')
      .max(8, 'Verification code cannot exceed 8 digits')
      .regex(/^\d+$/, 'Verification code must contain only numbers'),
  }),
};

export const otpResendSchema = {
  body: z.object({
    challengeId: z.string().uuid('Invalid verification session ID'),
  }),
};

