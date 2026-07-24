import { z } from 'zod';

export const createGroupSchema = z.object({
  name: z.string().trim().min(1).max(200),
});

export const updateGroupSchema = z.object({
  name: z.string().trim().min(1).max(200),
});
