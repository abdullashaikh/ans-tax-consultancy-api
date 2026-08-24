import { z } from 'zod';

export const createConversationSchema = {
  body: z.object({
    applicationId: z.number().int().positive().optional(),
  }),
};

export const sendMessageSchema = {
  params: z.object({
    id: z.string(),
  }),
  body: z.object({
    message: z.string().min(1, 'Message cannot be empty').max(5000),
    documentId: z.number().int().positive().optional(),
  }),
};
