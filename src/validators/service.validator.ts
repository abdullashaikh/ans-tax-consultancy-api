import { z } from 'zod';

export const createCategorySchema = {
  body: z.object({
    name: z.string().min(1).max(100),
    slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
    description: z.string().optional().nullable(),
    icon: z.string().optional().nullable(),
    displayOrder: z.number().int().nonnegative().default(0),
    isActive: z.boolean().default(true),
  }),
};

export const updateCategorySchema = {
  params: z.object({
    id: z.string(),
  }),
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens').optional(),
    description: z.string().optional().nullable(),
    icon: z.string().optional().nullable(),
    displayOrder: z.number().int().nonnegative().optional(),
    isActive: z.boolean().optional(),
  }),
};

export const createServiceSchema = {
  body: z.object({
    categoryId: z.number().int().positive(),
    name: z.string().min(1).max(200),
    slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
    icon: z.string().optional().nullable(),
    shortDescription: z.string().max(500).optional().nullable(),
    description: z.string().optional().nullable(),
    features: z.any().optional().nullable(),
    eligibility: z.string().optional().nullable(),
    documentsRequiredDescription: z.string().optional().nullable(),
    processingTime: z.string().max(100).optional().nullable(),
    basePrice: z.number().nonnegative().optional().nullable(),
    discountPrice: z.number().nonnegative().optional().nullable(),
    currency: z.string().length(3).default('INR'),
    isActive: z.boolean().default(true),
    isFeatured: z.boolean().default(false),
    displayOrder: z.number().int().nonnegative().default(0),
  }),
};

export const updateServiceSchema = {
  params: z.object({
    id: z.string(),
  }),
  body: z.object({
    categoryId: z.number().int().positive().optional(),
    name: z.string().min(1).max(200).optional(),
    slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/).optional(),
    icon: z.string().optional().nullable(),
    shortDescription: z.string().max(500).optional().nullable(),
    description: z.string().optional().nullable(),
    features: z.any().optional().nullable(),
    eligibility: z.string().optional().nullable(),
    documentsRequiredDescription: z.string().optional().nullable(),
    processingTime: z.string().max(100).optional().nullable(),
    basePrice: z.number().nonnegative().optional().nullable(),
    discountPrice: z.number().nonnegative().optional().nullable(),
    currency: z.string().length(3).optional(),
    isActive: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
    displayOrder: z.number().int().nonnegative().optional(),
  }),
};

export const updateServicePricingSchema = {
  params: z.object({
    id: z.string(),
  }),
  body: z.object({
    basePrice: z.number().nonnegative('Base price must be a non-negative number'),
    discountPrice: z.number().nonnegative('Discount price must be a non-negative number').optional().nullable(),
    currency: z.string().length(3).default('INR'),
    reason: z.string().max(255).optional(),
  }),
};

export const toggleStatusSchema = {
  params: z.object({
    id: z.string(),
  }),
  body: z.object({
    isActive: z.boolean(),
  }),
};
