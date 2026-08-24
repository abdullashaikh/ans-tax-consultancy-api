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
  body: z.object({
    token: z.string().min(1, 'Reset token is required'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters long').max(100),
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
