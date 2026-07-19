import { z } from 'zod';

export const createGroupSchema = z.object({
  name: z.string().trim().min(1).max(200),
  userIds: z.array(z.string().uuid()).default([]),
});

export const updateGroupSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  userIds: z.array(z.string().uuid()).optional(),
});
