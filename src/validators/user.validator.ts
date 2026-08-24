import { z } from 'zod';
import { RoleName } from '../constants/roles';

export const updateUserSchema = {
  body: z.object({
    firstName: z.string().min(1).max(100).optional(),
    lastName: z.string().min(1).max(100).optional(),
    phone: z.string().regex(/^[0-9+\-\s()]{7,20}$/).optional(),
  }),
};

export const adminUpdateUserSchema = {
  params: z.object({
    id: z.string().uuid('Invalid user UUID'),
  }),
  body: z.object({
    firstName: z.string().min(1).max(100).optional(),
    lastName: z.string().min(1).max(100).optional(),
    phone: z.string().regex(/^[0-9+\-\s()]{7,20}$/).optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
    roles: z.array(z.nativeEnum(RoleName)).optional(),
  }),
};

export const listUsersSchema = {
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'DELETED']).optional(),
    search: z.string().optional(),
  }),
};
