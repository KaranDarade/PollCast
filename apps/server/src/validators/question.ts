import { z } from 'zod';

export const createQuestionSchema = z.object({
  eventId: z.string().uuid(),
  content: z.string().min(10, 'Question must be at least 10 characters').max(500).trim(),
  isAnonymous: z.boolean().default(false),
});

export const moderateQuestionSchema = z.object({
  questionId: z.string().uuid(),
  action: z.enum(['approve', 'reject', 'pin', 'unpin']),
});

export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;
