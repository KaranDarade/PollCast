import { z } from 'zod';

export const createPollSchema = z.object({
  eventId: z.string().uuid(),
  title: z.string().min(3).max(300).trim(),
  type: z.enum(['POLL', 'QUIZ']).default('POLL'),
  isMultipleChoice: z.boolean().default(false),
  timerSeconds: z.number().int().positive().max(3600).optional(),
  options: z
    .array(z.string().min(1).max(300).trim())
    .min(2, 'At least 2 options required')
    .max(10, 'Maximum 10 options'),
});

export const castVoteSchema = z.object({
  pollId: z.string().uuid(),
  optionIds: z.array(z.string().uuid()).min(1, 'At least one option required'),
});

export type CreatePollInput = z.infer<typeof createPollSchema>;
export type CastVoteInput = z.infer<typeof castVoteSchema>;
