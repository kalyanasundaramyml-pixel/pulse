import { z } from 'zod';

export const createCircleSchema = z.object({
  name: z.string().trim().min(1).max(200),
  memberIds: z.array(z.string().uuid()).default([]),
});

export const updateCircleSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  memberIds: z.array(z.string().uuid()).optional(),
});
