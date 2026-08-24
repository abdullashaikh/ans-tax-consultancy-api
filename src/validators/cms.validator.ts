import { z } from 'zod';

export const createFaqSchema = {
  body: z.object({
    serviceId: z.number().int().positive().optional(),
    question: z.string().min(1).max(500),
    answer: z.string().min(1).max(5000),
    displayOrder: z.number().int().nonnegative().default(0),
  }),
};

export const updateFaqSchema = {
  params: z.object({
    id: z.string(),
  }),
  body: z.object({
    question: z.string().min(1).max(500).optional(),
    answer: z.string().min(1).max(5000).optional(),
    displayOrder: z.number().int().nonnegative().optional(),
    isActive: z.boolean().optional(),
  }),
};

export const createBlogPostSchema = {
  body: z.object({
    categoryId: z.number().int().positive(),
    title: z.string().min(1).max(255),
    slug: z.string().min(1).max(255).regex(/^[a-z0-9-]+$/),
    excerpt: z.string().max(1000).optional(),
    content: z.string().min(1),
    featuredImage: z.string().url().max(500).optional(),
    metaTitle: z.string().max(255).optional(),
    metaDescription: z.string().max(500).optional(),
  }),
};

export const updateBlogPostSchema = {
  params: z.object({
    id: z.string(),
  }),
  body: z.object({
    categoryId: z.number().int().positive().optional(),
    title: z.string().min(1).max(255).optional(),
    slug: z.string().min(1).max(255).regex(/^[a-z0-9-]+$/).optional(),
    excerpt: z.string().max(1000).optional(),
    content: z.string().optional(),
    featuredImage: z.string().url().max(500).optional(),
    metaTitle: z.string().max(255).optional(),
    metaDescription: z.string().max(500).optional(),
  }),
};
