import { z } from 'zod';

export const createApplicationSchema = {
  body: z.object({
    serviceId: z.number().int().positive('Service ID is required'),
    title: z.string().max(255).optional(),
    description: z.string().optional(),
    notes: z.string().optional(),
    financialYear: z.string().optional(),
    assessmentYear: z.string().optional(),
    priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
  }),
};

export const updateApplicationStatusSchema = {
  params: z.object({
    id: z.string().uuid('Invalid application UUID'),
  }),
  body: z.object({
    status: z.enum([
      'DRAFT',
      'SUBMITTED',
      'DOCUMENTS_PENDING',
      'DOCUMENTS_RECEIVED',
      'UNDER_REVIEW',
      'ASSIGNED',
      'IN_PROGRESS',
      'PAYMENT_PENDING',
      'FILED',
      'COMPLETED',
      'ON_HOLD',
      'CANCELLED',
      'REJECTED',
    ]),
    reason: z.string().optional(),
  }),
};

export const assignConsultantSchema = {
  params: z.object({
    id: z.string().uuid('Invalid application UUID'),
  }),
  body: z.object({
    consultantId: z.number().int().positive('Consultant user ID is required'),
    notes: z.string().optional(),
  }),
};

export const updateApplicationAmountsSchema = {
  params: z.object({
    id: z.string().uuid('Invalid application UUID'),
  }),
  body: z.object({
    quotedAmount: z.number().nonnegative().optional(),
    finalAmount: z.number().nonnegative().optional(),
    currency: z.string().length(3).default('INR'),
  }),
};

export const listApplicationsSchema = {
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    status: z.string().optional(),
    priority: z.string().optional(),
    serviceId: z.string().optional(),
    search: z.string().optional(),
  }),
};
