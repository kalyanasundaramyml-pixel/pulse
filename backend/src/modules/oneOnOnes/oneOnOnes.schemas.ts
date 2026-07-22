import { z } from 'zod';
import { QuestionType } from '@prisma/client';

export const createTemplateSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(2000).optional(),
});

export const updateTemplateSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  description: z.string().trim().max(2000).optional(),
  isArchived: z.boolean().optional(),
  isPublic: z.boolean().optional(),
});

export const listTemplatesQuerySchema = z.object({
  scope: z.enum(['created', 'all', 'public']).default('created'),
});

export const createBlockSchema = z.object({
  name: z.string().trim().min(1).max(200),
});

export const updateBlockSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  body: z.string().trim().max(4000).optional(),
});

export const reorderBlocksSchema = z.object({
  blockIds: z.array(z.string().uuid()).min(1),
});

export const duplicateTemplateSchema = z.object({
  asTemplate: z.boolean().default(false),
});

const questionBaseSchema = z.object({
  questionType: z.nativeEnum(QuestionType),
  prompt: z.string().trim().min(1).max(1000),
  isRequired: z.boolean().default(true),
  ratingScaleMin: z.number().int().optional(),
  ratingScaleMax: z.number().int().optional(),
  options: z.array(z.string().trim().min(1).max(300)).optional(),
});

export const createQuestionSchema = questionBaseSchema.superRefine((data, ctx) => {
  if (data.questionType === 'RATING') {
    if (data.ratingScaleMin == null || data.ratingScaleMax == null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'RATING questions require ratingScaleMin and ratingScaleMax' });
    } else if (data.ratingScaleMin >= data.ratingScaleMax) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'ratingScaleMin must be less than ratingScaleMax' });
    }
  }
  if (data.questionType === 'SINGLE_CHOICE' || data.questionType === 'MULTI_CHOICE') {
    if (!data.options || data.options.length < 2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Choice questions require at least 2 options' });
    }
  }
});

export const updateQuestionSchema = questionBaseSchema.partial();

export const reorderQuestionsSchema = z.object({
  questionIds: z.array(z.string().uuid()).min(1),
});

export const setRecipientsSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1),
});

export const addRecipientsSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1),
});

export const startRunSchema = z.object({
  recipientUserId: z.string().uuid(),
});

export const answerSchema = z.object({
  questionId: z.string().uuid(),
  ratingValue: z.number().int().nullable().optional(),
  textValue: z.string().trim().max(5000).nullable().optional(),
  selectedOptionIds: z.array(z.string().uuid()).optional(),
  commentText: z.string().trim().max(2000).nullable().optional(),
});

export const submitRunSchema = z.object({
  answers: z.array(answerSchema),
});
