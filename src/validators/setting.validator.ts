import { z } from 'zod';

export const setSettingSchema = {
  body: z.object({
    key: z.string().min(1).max(100),
    value: z.string(),
    type: z.enum(['STRING', 'INTEGER', 'DECIMAL', 'BOOLEAN', 'JSON']).default('STRING'),
    description: z.string().max(255).optional(),
    isPublic: z.boolean().default(false),
  }),
};
