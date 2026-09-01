import { z } from 'zod';

export const createLeadSchema = {
  body: z.object({
    name: z.string().min(1, 'Name is required').max(200),
    email: z.string().email('Invalid email address').max(255).optional(),
    phone: z.string().regex(/^[0-9+\-\s()]{7,20}$/, 'Invalid phone number format').optional(),
    serviceId: z.number().int().positive().optional(),
    serviceInterest: z.string().max(200).optional(),
    businessType: z.string().max(100).optional(),
    city: z.string().max(100).optional(),
    state: z.string().max(100).optional(),
    annualTurnover: z.string().max(100).optional(),
    message: z.string().max(2000).optional(),
    source: z.string().max(50).default('WEBSITE'),
  }),
};

export const updateLeadStatusSchema = {
  params: z.object({
    id: z.string().uuid('Invalid lead UUID'),
  }),
  body: z.object({
    status: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST', 'CLOSED']),
    assignedTo: z.number().int().positive().optional(),
  }),
};

export const convertLeadSchema = {
  params: z.object({
    id: z.string().uuid('Invalid lead UUID'),
  }),
  body: z.object({
    clientType: z.enum(['INDIVIDUAL', 'BUSINESS']).default('INDIVIDUAL'),
    temporaryPassword: z.string().min(8).max(100),
  }),
};
