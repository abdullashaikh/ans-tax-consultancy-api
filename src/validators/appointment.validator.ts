import { z } from 'zod';

export const createAppointmentSchema = {
  body: z.object({
    consultantId: z.preprocess((val) => {
      if (val === undefined || val === null || val === '') return undefined;
      const parsed = Number(val);
      return isNaN(parsed) ? val : parsed;
    }, z.number().int().positive('Consultant user ID is required')),
    applicationId: z.preprocess((val) => {
      if (val === undefined || val === null || val === '') return undefined;
      const parsed = Number(val);
      return isNaN(parsed) ? val : parsed;
    }, z.number().int().positive().optional()),
    appointmentType: z.enum(['IN_PERSON', 'PHONE', 'VIDEO']),
    scheduledStart: z.string().datetime({ message: 'scheduledStart must be a valid ISO 8601 UTC date string' }),
    scheduledEnd: z.string().datetime({ message: 'scheduledEnd must be a valid ISO 8601 UTC date string' }),
    meetingUrl: z.string().url().max(500).optional(),
    notes: z.string().max(1000).optional(),
  }),
};

export const updateAppointmentStatusSchema = {
  params: z.object({
    id: z.string().uuid('Invalid appointment UUID'),
  }),
  body: z.object({
    status: z.enum(['REQUESTED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']),
  }),
};
