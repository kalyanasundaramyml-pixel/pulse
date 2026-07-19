import { z } from 'zod';
import { UserRole } from '@prisma/client';

export const listUsersQuerySchema = z.object({
  search: z.string().trim().optional(),
  role: z.nativeEnum(UserRole).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export const createUserSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().email(),
  role: z.nativeEnum(UserRole).default('USER'),
});

export const updateUserSchema = z.object({
  role: z.nativeEnum(UserRole).optional(),
  isActive: z.boolean().optional(),
});

export const directoryQuerySchema = z.object({
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});
