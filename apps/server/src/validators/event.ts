import { z } from 'zod';

export const createEventSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(200).trim(),
  description: z.string().max(2000).trim().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  password: z.string().min(4).max(100).optional(),
  maxParticipants: z.number().int().positive().optional(),
  settings: z
    .object({
      allowAnonymousQuestions: z.boolean().optional(),
      requireModeration: z.boolean().optional(),
      allowMultipleVotes: z.boolean().optional(),
    })
    .optional(),
});

export const updateEventSchema = createEventSchema.partial();

export const joinEventSchema = z.object({
  code: z.string().min(1, 'Join code is required'),
  password: z.string().optional(),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
