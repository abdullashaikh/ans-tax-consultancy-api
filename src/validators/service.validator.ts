import { z } from 'zod';

export const createCategorySchema = {
  body: z.object({
    name: z.string().min(1).max(100),
    slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be alphanumeric with hyphens'),
    description: z.string().optional(),
    icon: z.string().optional(),
    displayOrder: z.number().int().nonnegative().default(0),
  }),
};

export const createServiceSchema = {
  body: z.object({
    categoryId: z.number().int().positive(),
    name: z.string().min(1).max(200),
    slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/, 'Slug must be alphanumeric with hyphens'),
    shortDescription: z.string().max(500).optional(),
    description: z.string().optional(),
    eligibility: z.string().optional(),
    documentsRequiredDescription: z.string().optional(),
    processingTime: z.string().max(100).optional(),
    basePrice: z.number().nonnegative().optional(),
    currency: z.string().length(3).default('INR'),
    displayOrder: z.number().int().nonnegative().default(0),
  }),
};

export const updateServiceSchema = {
  params: z.object({
    id: z.string(),
  }),
  body: z.object({
    name: z.string().min(1).max(200).optional(),
    slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/).optional(),
    shortDescription: z.string().max(500).optional(),
    description: z.string().optional(),
    eligibility: z.string().optional(),
    documentsRequiredDescription: z.string().optional(),
    processingTime: z.string().max(100).optional(),
    basePrice: z.number().nonnegative().optional(),
    currency: z.string().length(3).optional(),
    isActive: z.boolean().optional(),
    displayOrder: z.number().int().nonnegative().optional(),
  }),
};
