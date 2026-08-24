import { z } from 'zod';

export const createClientSchema = {
  body: z.object({
    userId: z.number().int().positive().optional(),
    clientType: z.enum(['INDIVIDUAL', 'BUSINESS']),
    legalName: z.string().min(1).max(255),
    displayName: z.string().max(255).optional(),
    email: z.string().email().optional(),
    phone: z.string().max(20).optional(),
    alternatePhone: z.string().max(20).optional(),
    businessType: z.string().max(100).optional(),
    gstin: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GSTIN format').optional(),
    panReference: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format').optional(),
  }),
};

export const updateClientSchema = {
  params: z.object({
    id: z.string().uuid('Invalid client UUID'),
  }),
  body: z.object({
    legalName: z.string().min(1).max(255).optional(),
    displayName: z.string().max(255).optional(),
    email: z.string().email().optional(),
    phone: z.string().max(20).optional(),
    alternatePhone: z.string().max(20).optional(),
    businessType: z.string().max(100).optional(),
    gstin: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GSTIN format').optional(),
    panReference: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format').optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  }),
};

export const addClientAddressSchema = {
  params: z.object({
    id: z.string().uuid('Invalid client UUID'),
  }),
  body: z.object({
    addressType: z.enum(['RESIDENTIAL', 'BUSINESS', 'REGISTERED_OFFICE', 'BILLING', 'CORRESPONDENCE']),
    addressLine1: z.string().min(1).max(255),
    addressLine2: z.string().max(255).optional(),
    city: z.string().min(1).max(100),
    state: z.string().min(1).max(100),
    country: z.string().min(1).max(100).default('India'),
    postalCode: z.string().min(3).max(20),
    isPrimary: z.boolean().default(false),
  }),
};
