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

export const createOrderSchema = {
  body: z.object({
    amount: z.number().min(1, 'Payment amount must be at least 1 (min 100 paise)'),
    currency: z.string().length(3).default('INR').optional(),
    applicationId: z.number().int().positive().optional(),
    receipt: z.string().max(100).optional(),
    notes: z.record(z.any()).optional(),
  }),
};

export const verifyPaymentSchema = {
  body: z
    .object({
      razorpay_order_id: z.string().optional(),
      order_id: z.string().optional(),
      razorpay_payment_id: z.string().optional(),
      payment_id: z.string().optional(),
      razorpay_signature: z.string().optional(),
      signature: z.string().optional(),
    })
    .refine(
      (data) =>
        (!!data.razorpay_order_id || !!data.order_id) &&
        (!!data.razorpay_payment_id || !!data.payment_id) &&
        (!!data.razorpay_signature || !!data.signature),
      {
        message:
          'Missing required Razorpay verification fields: razorpay_order_id, razorpay_payment_id, and razorpay_signature',
      }
    ),
};

export const paymentWebhookSchema = {
  body: z.object({
    event: z.string(),
    payload: z.record(z.any()),
  }),
};
