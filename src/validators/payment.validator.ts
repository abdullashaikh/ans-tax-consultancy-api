import { z } from 'zod';

export const createPaymentSchema = {
  body: z.object({
    applicationId: z.number().int().positive('Application ID is required'),
    amount: z.number().positive('Payment amount must be greater than 0'),
    currency: z.string().length(3).default('INR'),
    paymentGateway: z.string().max(50).default('RAZORPAY'),
    paymentMethod: z.string().max(50).optional(),
  }),
};

export const paymentWebhookSchema = {
  body: z.object({
    event: z.string(),
    payload: z.record(z.any()),
  }),
};
