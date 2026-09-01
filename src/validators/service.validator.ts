import { z } from 'zod';

export const createCategorySchema = {
  body: z.object({
    name: z.string().min(1).max(100),
    slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
    region: z.enum(['INDIA', 'UAE', 'GLOBAL']).optional().default('INDIA'),
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
    region: z.enum(['INDIA', 'UAE', 'GLOBAL']).optional(),
    description: z.string().optional().nullable(),
    icon: z.string().optional().nullable(),
    displayOrder: z.number().int().nonnegative().optional(),
    isActive: z.boolean().optional(),
  }),
};

export const createServiceSchema = {
  body: z.object({
    somNumber: z.number().int().positive().optional().nullable(),
    categoryId: z.number().int().positive('Category ID must be a positive integer'),
    name: z.string().min(1).max(200),
    slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
    region: z.enum(['INDIA', 'UAE']).optional().default('INDIA'),
    icon: z.string().optional().nullable(),
    shortDescription: z.string().max(500).optional().nullable(),
    description: z.string().optional().nullable(),
    features: z.any().optional().nullable(),
    overview: z.string().optional().nullable(),
    eligibility: z.string().optional().nullable(),
    documentsRequiredDescription: z.string().optional().nullable(),
    requiredDocuments: z.any().optional().nullable(),
    deliverables: z.any().optional().nullable(),
    processSteps: z.any().optional().nullable(),
    processingTime: z.string().max(100).optional().nullable(),
    turnaround: z.string().max(100).optional().nullable(),
    basePrice: z.number().nonnegative().optional().nullable(),
    discountPrice: z.number().nonnegative().optional().nullable(),
    promoPrice: z.number().nonnegative().optional().nullable(),
    pricingNotes: z.string().optional().nullable(),
    exclusions: z.any().optional().nullable(),
    relatedServiceIds: z.array(z.number().int().positive()).optional().nullable(),
    seoTitle: z.string().max(255).optional().nullable(),
    metaDescription: z.string().max(500).optional().nullable(),
    h1Heading: z.string().max(255).optional().nullable(),
    primaryCtaText: z.string().max(100).optional().nullable(),
    primaryCtaLink: z.string().max(255).optional().nullable(),
    ctaType: z.string().max(50).optional().nullable(),
    currency: z.string().length(3).optional(),
    billingPeriod: z.string().max(50).optional(),
    pricingMode: z.string().max(50).optional(),
    isActive: z.boolean().default(true),
    isFeatured: z.boolean().default(false),
    displayOrder: z.number().int().nonnegative().default(0),
    faqs: z.array(z.object({
      question: z.string().min(1),
      answer: z.string().min(1),
      displayOrder: z.number().int().optional(),
      isActive: z.boolean().optional(),
    })).optional(),
    documentsList: z.array(z.object({
      name: z.string().min(1),
      description: z.string().optional().nullable(),
      isRequired: z.boolean().optional(),
      displayOrder: z.number().int().optional(),
    })).optional(),
    processStepsList: z.array(z.object({
      stepNumber: z.number().int().optional(),
      title: z.string().min(1),
      description: z.string(),
    })).optional(),
  }),
};

export const updateServiceSchema = {
  params: z.object({
    id: z.string(),
  }),
  body: z.object({
    somNumber: z.number().int().positive().optional().nullable(),
    categoryId: z.number().int().positive().optional(),
    name: z.string().min(1).max(200).optional(),
    slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/).optional(),
    region: z.enum(['INDIA', 'UAE']).optional(),
    icon: z.string().optional().nullable(),
    shortDescription: z.string().max(500).optional().nullable(),
    description: z.string().optional().nullable(),
    features: z.any().optional().nullable(),
    overview: z.string().optional().nullable(),
    eligibility: z.string().optional().nullable(),
    documentsRequiredDescription: z.string().optional().nullable(),
    requiredDocuments: z.any().optional().nullable(),
    deliverables: z.any().optional().nullable(),
    processSteps: z.any().optional().nullable(),
    processingTime: z.string().max(100).optional().nullable(),
    turnaround: z.string().max(100).optional().nullable(),
    basePrice: z.number().nonnegative().optional().nullable(),
    discountPrice: z.number().nonnegative().optional().nullable(),
    promoPrice: z.number().nonnegative().optional().nullable(),
    pricingNotes: z.string().optional().nullable(),
    exclusions: z.any().optional().nullable(),
    relatedServiceIds: z.array(z.number().int().positive()).optional().nullable(),
    seoTitle: z.string().max(255).optional().nullable(),
    metaDescription: z.string().max(500).optional().nullable(),
    h1Heading: z.string().max(255).optional().nullable(),
    primaryCtaText: z.string().max(100).optional().nullable(),
    primaryCtaLink: z.string().max(255).optional().nullable(),
    ctaType: z.string().max(50).optional().nullable(),
    currency: z.string().length(3).optional(),
    billingPeriod: z.string().max(50).optional(),
    pricingMode: z.string().max(50).optional(),
    isActive: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
    displayOrder: z.number().int().nonnegative().optional(),
    faqs: z.array(z.object({
      question: z.string().min(1),
      answer: z.string().min(1),
      displayOrder: z.number().int().optional(),
      isActive: z.boolean().optional(),
    })).optional(),
    documentsList: z.array(z.object({
      name: z.string().min(1),
      description: z.string().optional().nullable(),
      isRequired: z.boolean().optional(),
      displayOrder: z.number().int().optional(),
    })).optional(),
    processStepsList: z.array(z.object({
      stepNumber: z.number().int().optional(),
      title: z.string().min(1),
      description: z.string(),
    })).optional(),
  }),
};

export const updateServicePricingSchema = {
  params: z.object({
    id: z.string(),
  }),
  body: z.object({
    basePrice: z.number().nonnegative().nullable().optional(),
    discountPrice: z.number().nonnegative().nullable().optional(),
    promoPrice: z.number().nonnegative().nullable().optional(),
    currency: z.string().length(3).optional(),
    reason: z.string().min(1, 'A reason for the price update is required for audit logs').max(500),
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
