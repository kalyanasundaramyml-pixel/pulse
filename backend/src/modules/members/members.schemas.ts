import { z } from 'zod';
import { MemberRole } from '@prisma/client';

export const listMembersQuerySchema = z.object({
  search: z.string().trim().optional(),
  role: z.nativeEnum(MemberRole).optional(),
  groupId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export const createMemberSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().email(),
  role: z.nativeEnum(MemberRole).default('MEMBER'),
  groupId: z.string().uuid().optional(),
});

export const updateMemberSchema = z.object({
  role: z.nativeEnum(MemberRole).optional(),
  groupId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
});

export const directoryQuerySchema = z.object({
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});
