import { z } from 'zod';

export const answerSchema = z.object({
  questionId: z.string().uuid(),
  ratingValue: z.number().int().nullable().optional(),
  textValue: z.string().trim().max(5000).nullable().optional(),
  selectedOptionIds: z.array(z.string().uuid()).optional(),
  commentText: z.string().trim().max(2000).nullable().optional(),
});

export const submitResponseSchema = z.object({
  answers: z.array(answerSchema),
});
